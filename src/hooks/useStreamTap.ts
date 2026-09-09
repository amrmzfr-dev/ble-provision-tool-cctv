import { useEffect, useRef, useState } from 'react'
import { adminGetDevice } from '@/lib/api/client'
import { ApiError, getAuthToken } from '@/lib/api/config'
import { logEvent } from '@/lib/debugLog'

const POLL_INTERVAL_MS = 3000
const MAX_LOG_LINES = 300

// No separate 'streaming' phase — see the note above the effect that reads
// the stream body for why setting one from inside that effect was itself the
// bug that caused "0 chunks, 0.0 KB" forever. 'stopped' is a deliberate user
// action (the Stop button), distinct from 'error'.
export type StreamTapPhase = 'waiting-online' | 'connecting' | 'stopped' | 'error'

export interface StreamTapStats {
  chunks: number
  bytes: number
  startedAt: number
}

function formatClock(date: Date): string {
  return (
    date.toLocaleTimeString(undefined, { hour12: false, minute: '2-digit', second: '2-digit' }) +
    '.' +
    String(date.getMilliseconds()).padStart(3, '0')
  )
}

/**
 * Not a video player — the camera streams HEVC (H.265) on both main and sub
 * streams (confirmed with ffprobe against a captured admin stream), and
 * browsers' Media Source Extensions essentially never support HEVC. This
 * proves bytes are actually flowing end to end instead: browser -> this
 * app's nginx -> the mini backend -> the camera's live NetSDK session and
 * back, logged line by line like the backend's own
 * "[STREAM_DATA] Received frame N (size: X bytes)" logging.
 *
 * Extracted from the original StreamScreen.tsx so both the standalone
 * full-screen stream view (reached right after pairing) and the embedded
 * section on a camera's detail page share one implementation — the
 * self-abort bug (setPhase() from inside the read loop tearing down its own
 * fetch) only needs fixing once this way.
 */
export function useStreamTap(serial: string) {
  const [phase, setPhase] = useState<StreamTapPhase>('waiting-online')
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<StreamTapStats | null>(null)
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

        // Deliberately NOT calling setPhase() here (or anywhere else once
        // reading starts) — this effect is keyed on `phase`, so changing it
        // would run this same effect's own cleanup below (cancelled = true;
        // controller.abort()) on the very next render, aborting the fetch
        // moments after it started. `stats` being non-null is what the UI
        // uses to know we're live instead.
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

  return { phase, error, stats, lines, logBoxRef, isLive, stop, restart }
}
