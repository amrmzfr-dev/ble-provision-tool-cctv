import { AlertTriangle, Loader2, Play, Radio, RotateCcw, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { adminGetDevice } from '@/lib/api/client'
import { ApiError, getAuthToken } from '@/lib/api/config'
import { logEvent } from '@/lib/debugLog'

const POLL_INTERVAL_MS = 3000
const MAX_LOG_LINES = 300

interface StreamScreenProps {
  serial: string
  onBack: () => void
}

// No separate 'streaming' phase — see the note above the effect that reads
// the stream body for why setting one from inside that effect was itself the
// bug that caused "0 chunks, 0.0 KB" forever. 'stopped' is a deliberate user
// action (the Stop button), distinct from 'error'.
type Phase = 'waiting-online' | 'connecting' | 'stopped' | 'error'

interface Stats {
  chunks: number
  bytes: number
  startedAt: number
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour12: false, minute: '2-digit', second: '2-digit' }) + '.' + String(date.getMilliseconds()).padStart(3, '0')
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
 * app's nginx -> the mini backend -> the camera's live NetSDK session and
 * back. It reads the raw HTTP stream directly and logs each chunk as its own
 * line, the same proof-of-life the backend's own log shows via
 * "[STREAM_DATA] Received frame N (size: X bytes)" — a real line-by-line
 * feed rather than a single summary tile.
 */
export function StreamScreen({ serial, onBack }: StreamScreenProps) {
  const [phase, setPhase] = useState<Phase>('waiting-online')
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const logBoxRef = useRef<HTMLDivElement | null>(null)

  const appendLine = (line: string) => {
    setLines((prev) => {
      const next = [...prev, line]
      return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next
    })
  }

  useEffect(() => {
    logBoxRef.current?.scrollTo({ top: logBoxRef.current.scrollHeight })
  }, [lines])

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

        const url = new URL(info.admin_stream_url, window.location.origin)
        url.searchParams.set('format', 'ts')
        url.searchParams.set('channel', '0')
        url.searchParams.set('stream_type', '0')

        // Authenticated with THIS app's own login now, not the camera
        // backend's admin key directly — the mini backend attaches that
        // server-side once it sees this Bearer token is valid.
        const token = getAuthToken()
        logEvent('tx', `Opening raw stream tap: ${url.pathname}?${url.searchParams.toString()}`)
        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
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
        setStats({ chunks, bytes, startedAt })
        setLines([])
        appendLine(`${formatClock(new Date())}  connected — reading live stream body`)

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            appendLine(`${formatClock(new Date())}  stream ended (camera stopped or connection closed)`)
            break
          }
          if (cancelled) break
          chunks += 1
          bytes += value.byteLength
          setStats({ chunks, bytes, startedAt })
          appendLine(
            `${formatClock(new Date())}  chunk ${chunks}  +${(value.byteLength / 1024).toFixed(1)} KB  (total ${(bytes / 1024).toFixed(1)} KB)`,
          )
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

  const stop = () => {
    abortRef.current?.abort()
    appendLine(`${formatClock(new Date())}  stopped by user`)
    setPhase('stopped')
  }

  const restart = () => {
    setError(null)
    setStats(null)
    setLines([])
    setPhase('waiting-online')
  }

  const isLive = phase === 'connecting' && stats !== null

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

      {phase === 'error' && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-center">
          <AlertTriangle className="size-6 text-destructive" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-destructive">Couldn't confirm the stream</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      )}

      {!stats && phase !== 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-5 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-semibold">
            {phase === 'waiting-online' ? 'Waiting for the camera to be online…' : 'Opening the stream…'}
          </p>
          <p className="text-xs text-muted-foreground">
            Checking <code className="font-mono">/admin/device/{serial}</code> fresh, same as the
            reference Android app does right before it opens a stream.
          </p>
        </div>
      )}

      {stats && (
        <>
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase">
              <Radio className={isLive ? 'size-3.5 animate-gc-pulse text-primary' : 'size-3.5 text-muted-foreground'} />
              {isLive ? 'Live' : 'Stopped'}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {stats.chunks} chunks · {(stats.bytes / 1024).toFixed(1)} KB
            </span>
          </div>

          <div
            ref={logBoxRef}
            className="flex-1 overflow-y-auto rounded-2xl border border-border bg-[#0c0c0c] p-3 font-mono text-[11px] leading-relaxed text-lime"
          >
            {lines.length === 0 ? (
              <p className="text-white/30">Waiting for the first chunk…</p>
            ) : (
              lines.map((line, i) => <p key={i}>{line}</p>)
            )}
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        No video preview: this camera streams H.265, which browsers can't decode. This confirms
        the full path — browser → backend → the camera's live session — is actually working.
      </p>

      <div className="flex gap-2">
        {isLive && (
          <Button variant="outline" className="flex-1" onClick={stop}>
            <Square />
            Stop
          </Button>
        )}
        {(phase === 'stopped' || phase === 'error') && (
          <Button variant="outline" className="flex-1" onClick={restart}>
            {phase === 'error' ? <RotateCcw /> : <Play />}
            {phase === 'error' ? 'Retry' : 'Start'}
          </Button>
        )}
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  )
}
