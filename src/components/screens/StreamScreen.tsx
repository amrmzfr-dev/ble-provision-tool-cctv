import { AlertTriangle, Loader2, Radio, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { adminGetDevice } from '@/lib/api/client'
import { ApiError, getAdminKey } from '@/lib/api/config'
import { logEvent } from '@/lib/debugLog'

const POLL_INTERVAL_MS = 3000
const SUMMARY_INTERVAL_MS = 1000

interface StreamScreenProps {
  serial: string
  onBack: () => void
}

// No separate 'streaming' phase — see the note above the effect that reads
// the stream body for why setting one from inside that effect was itself the
// bug that caused "0 chunks, 0.0 KB" forever.
type Phase = 'waiting-online' | 'connecting' | 'error'

interface Stats {
  chunks: number
  bytes: number
  startedAt: number
  lastChunkAt: number | null
}

/**
 * Not a video player — the camera streams HEVC (H.265) on both main and sub
 * streams (confirmed with ffprobe against a captured admin stream), and
 * browsers' Media Source Extensions essentially never support HEVC. mpegts.js
 * demuxed the container fine but the browser could never build a playable
 * buffer from it, so it just buffered forever with no error — tried and
 * ruled out, not a guess. The Android reference app avoids this entirely by
 * using VLC's own software decoder (libvlc/FFmpeg), which has no browser
 * codec-support ceiling; there's no web equivalent to that.
 *
 * What this screen proves instead — genuinely useful for a pairing-test
 * tool — is that bytes are actually flowing end to end: browser -> this
 * app's nginx -> cctv.czeros.tech -> the camera's live NetSDK session and
 * back. It reads the raw HTTP stream directly and tallies chunks/bytes live,
 * the same proof-of-life the backend's own log shows via
 * "[STREAM_DATA] Received frame N (size: X bytes)".
 */
export function StreamScreen({ serial, onBack }: StreamScreenProps) {
  const [phase, setPhase] = useState<Phase>('waiting-online')
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (phase !== 'waiting-online') return
    let cancelled = false

    const poll = async () => {
      try {
        logEvent('tx', `GET /admin/device/${serial}`)
        const info = await adminGetDevice(serial)
        if (cancelled) return
        logEvent('rx', `connected=${info.connected} admin_stream_url=${info.admin_stream_url}`)

        if (info.connected && info.admin_stream_url) {
          setPhase('connecting')
          return
        }
      } catch (err) {
        if (cancelled) return
        const message = err instanceof ApiError ? err.message : String(err)
        logEvent('error', `admin/device poll failed: ${message}`)
      }
      if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [phase, serial])

  useEffect(() => {
    if (phase !== 'connecting') return
    let cancelled = false
    const controller = new AbortController()
    abortRef.current = controller

    const start = async () => {
      try {
        // Fresh, right before use — same rule as the wifi-configured timing
        // bug taught us. A UUID/session seen a moment ago can already be gone.
        logEvent('tx', `GET /admin/device/${serial} (fresh, right before opening the stream)`)
        const info = await adminGetDevice(serial)
        if (cancelled) return

        if (!info.connected || !info.admin_stream_url) {
          logEvent('error', 'Camera no longer connected by the time we went to open the stream')
          setPhase('waiting-online')
          return
        }

        const adminKey = getAdminKey()
        const url = new URL(info.admin_stream_url, window.location.origin)
        url.searchParams.set('format', 'ts')
        url.searchParams.set('channel', '0')
        url.searchParams.set('stream_type', '0')
        if (adminKey) url.searchParams.set('admin_key', adminKey)

        logEvent('tx', `Opening raw stream tap: ${url.pathname}?${url.searchParams.toString()}`)
        const response = await fetch(url.toString(), { signal: controller.signal })
        if (cancelled) return
        if (!response.ok || !response.body) {
          logEvent('error', `Stream request failed: HTTP ${response.status}`)
          setError(`Stream request failed: HTTP ${response.status}`)
          setPhase('error')
          return
        }

        // Deliberately NOT calling setPhase() here (or anywhere else in this
        // function once reading starts) — this effect is keyed on `phase`,
        // so changing it would run this same effect's own cleanup below
        // (cancelled = true; controller.abort()) on the very next render,
        // aborting the fetch moments after it started. That was the actual
        // cause of the stuck "0 chunks, 0.0 KB": the read loop got torn down
        // by its own phase transition before a chunk ever arrived. `stats`
        // being non-null is what the UI uses to know we're live instead.
        const reader = response.body.getReader()
        const startedAt = Date.now()
        let chunks = 0
        let bytes = 0
        let lastChunkAt: number | null = null
        setStats({ chunks, bytes, startedAt, lastChunkAt })
        logEvent('success', 'First response received — reading live stream body')

        const summaryTimer = setInterval(() => {
          if (cancelled) return
          const elapsed = (Date.now() - startedAt) / 1000
          const kbps = elapsed > 0 ? bytes / 1024 / elapsed : 0
          logEvent(
            'info',
            `Stream activity: ${chunks} chunks, ${(bytes / 1024).toFixed(1)} KB total, ${kbps.toFixed(1)} KB/s avg`,
          )
        }, SUMMARY_INTERVAL_MS)

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              logEvent('info', 'Stream ended (camera stopped or connection closed)')
              break
            }
            if (cancelled) break
            chunks += 1
            bytes += value.byteLength
            lastChunkAt = Date.now()
            setStats({ chunks, bytes, startedAt, lastChunkAt })
          }
        } finally {
          clearInterval(summaryTimer)
        }

        if (!cancelled) {
          setPhase('error')
          setError('The stream ended.')
        }
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        const message = err instanceof ApiError ? err.message : String(err)
        logEvent('error', `Stream tap failed: ${message}`)
        setError(message)
        setPhase('error')
      }
    }

    void start()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [phase, serial])

  const retry = () => {
    abortRef.current?.abort()
    setError(null)
    setStats(null)
    setPhase('waiting-online')
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Live view
        </span>
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">
          Stream activity
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Serial <code className="font-mono font-medium text-foreground">{serial}</code>
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-5 text-center">
        {phase === 'error' ? (
          <>
            <AlertTriangle className="size-8 text-destructive" strokeWidth={1.5} />
            <p className="text-sm font-semibold">Couldn't confirm the stream</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </>
        ) : stats ? (
          <>
            <div className="relative flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-destructive text-primary-foreground">
              <span className="absolute inset-0 rounded-2xl bg-primary/50 animate-gc-pulse" />
              <Radio className="relative size-8" />
            </div>
            <p className="text-sm font-semibold">Live bytes flowing from the camera</p>
            <div className="grid w-full grid-cols-2 gap-2 text-left">
              <div className="rounded-xl bg-muted p-3">
                <span className="block font-mono text-[10px] uppercase text-muted-foreground">Chunks</span>
                <span className="font-mono text-lg font-bold">{stats.chunks}</span>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <span className="block font-mono text-[10px] uppercase text-muted-foreground">Received</span>
                <span className="font-mono text-lg font-bold">{(stats.bytes / 1024).toFixed(1)} KB</span>
              </div>
            </div>
            <p className="max-w-[32ch] text-xs text-muted-foreground">
              This confirms the full path — browser → backend → the camera's live session — is
              working. Video preview isn't shown: this camera streams H.265, which browsers can't
              decode; see the debug log for details.
            </p>
          </>
        ) : (
          <>
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-semibold">
              {phase === 'waiting-online' ? 'Waiting for the camera to be online…' : 'Opening the stream…'}
            </p>
            <p className="text-xs text-muted-foreground">
              Checking <code className="font-mono">/admin/device/{serial}</code> fresh, same as the
              reference Android app does right before it opens a stream.
            </p>
          </>
        )}
      </div>

      <div className="flex gap-2">
        {phase === 'error' && (
          <Button variant="outline" className="flex-1" onClick={retry}>
            <RotateCcw />
            Retry
          </Button>
        )}
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  )
}
