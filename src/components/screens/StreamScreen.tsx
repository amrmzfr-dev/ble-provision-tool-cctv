import { AlertTriangle, Loader2, Radio, RotateCcw } from 'lucide-react'
import mpegts from 'mpegts.js'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { adminGetDevice } from '@/lib/api/client'
import { ApiError, getAdminKey } from '@/lib/api/config'
import { logEvent } from '@/lib/debugLog'

const POLL_INTERVAL_MS = 3000
const STALL_TIMEOUT_MS = 10000

interface StreamScreenProps {
  serial: string
  onBack: () => void
}

type Phase = 'waiting-online' | 'loading' | 'playing' | 'error'

/**
 * Mirrors exactly how AndroidOpenDemo's DeviceDetailActivity ->
 * AdminStreamActivity plays a live camera: it never hardcodes or reuses a
 * stream UUID. It calls GET /api/admin/device/<serial> right before opening
 * the stream and uses whatever admin_stream_url comes back at that moment
 * (that endpoint checks stream_manager.loginIDs live, so an old/stale UUID
 * or a call made before login finished is a dead end even if the DB says
 * "connected"). Confirmed against the real backend: a fresh call here
 * returns a working URL even when a previous, separately-obtained UUID 404s
 * or 500s.
 */
export function StreamScreen({ serial, onBack }: StreamScreenProps) {
  const [phase, setPhase] = useState<Phase>('waiting-online')
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

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
          setPhase('loading')
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
    if (phase !== 'loading') return
    let cancelled = false

    const start = async () => {
      try {
        // Re-fetch right here too, not just in the previous phase — this is
        // the same "ask fresh, right before use" rule the timing bug taught
        // us for wifi-configured. Any delay between "we saw connected" and
        // "we opened the stream" is a place for the UUID/session to go stale.
        logEvent('tx', `GET /admin/device/${serial} (fresh, right before stream open)`)
        const info = await adminGetDevice(serial)
        if (cancelled) return

        if (!info.connected || !info.admin_stream_url) {
          logEvent('error', 'Camera no longer connected by the time we went to open the stream')
          setPhase('waiting-online')
          return
        }

        const adminKey = getAdminKey()
        const url = new URL(info.admin_stream_url, window.location.origin)
        // AndroidOpenDemo's DeviceDetailActivity.openCameraStream() builds its
        // URL with format=ts, not flv — confirmed by reading its source. FLV
        // (tried first here) loaded and downloaded real bytes over curl fine,
        // but sat "loading" forever in the browser with no error: the Dahua
        // backend's FLV muxing apparently isn't clean enough for MSE's strict
        // appendBuffer to accept, which fails silently rather than raising an
        // ERROR event. mpegts.js's own primary format is MPEG-TS, matching
        // what the reference app actually uses.
        url.searchParams.set('format', 'ts')
        url.searchParams.set('channel', '0')
        url.searchParams.set('stream_type', '0')
        if (adminKey) url.searchParams.set('admin_key', adminKey)

        if (!mpegts.isSupported()) {
          setError('This browser cannot play the live stream (Media Source Extensions unsupported).')
          setPhase('error')
          return
        }

        if (!videoRef.current) {
          // Should never happen now that <video> is always mounted, but
          // load() throws an opaque IllegalStateException if this is skipped
          // — fail loudly instead of silently calling load() unattached.
          logEvent('error', 'video element ref not ready, cannot attach player')
          setError('Internal error: video element not ready.')
          setPhase('error')
          return
        }
        const video = videoRef.current

        const player = mpegts.createPlayer({ type: 'mpegts', isLive: true, url: url.toString() })
        playerRef.current = player
        player.attachMediaElement(video)

        // Wire up everything that can tell us what's actually happening —
        // previously the only log line was "Playing stream: ..." right after
        // calling load()/play(), which says nothing about whether the
        // browser is actually receiving/decoding frames. A stuck "loading"
        // state with no error event (exactly what FLV did above) was
        // otherwise invisible in the debug log.
        player.on(mpegts.Events.ERROR, (errType, detail) => {
          if (cancelled) return
          logEvent('error', `mpegts ERROR: ${String(errType)} / ${String(detail)}`)
          setError('The stream dropped or failed to load.')
          setPhase('error')
        })
        player.on(mpegts.Events.MEDIA_INFO, (mediaInfo: unknown) => {
          logEvent('rx', `mpegts MEDIA_INFO: ${JSON.stringify(mediaInfo)}`)
        })
        player.on(mpegts.Events.LOADING_COMPLETE, () => {
          logEvent('info', 'mpegts LOADING_COMPLETE')
        })

        let stallTimer: ReturnType<typeof setTimeout> | undefined

        const onLoadedMetadata = () => logEvent('info', 'video loadedmetadata')
        const onCanPlay = () => logEvent('info', 'video canplay')
        const onWaiting = () => logEvent('info', 'video waiting (buffering)')
        const onStalled = () => logEvent('error', 'video stalled')
        const onVideoError = () => logEvent('error', `video element error: ${video.error?.message ?? video.error?.code}`)
        const onPlaying = () => {
          if (cancelled) return
          logEvent('success', 'video playing — first frame rendered')
          clearTimeout(stallTimer)
          setPhase('playing')
        }
        video.addEventListener('loadedmetadata', onLoadedMetadata)
        video.addEventListener('canplay', onCanPlay)
        video.addEventListener('waiting', onWaiting)
        video.addEventListener('stalled', onStalled)
        video.addEventListener('error', onVideoError)
        video.addEventListener('playing', onPlaying)

        stallTimer = setTimeout(() => {
          if (cancelled) return
          logEvent(
            'error',
            `No 'playing' event within ${STALL_TIMEOUT_MS}ms — stream loaded but the browser never rendered a frame (likely an unsupported codec or a muxing issue MSE rejected silently)`,
          )
          setError("The stream loaded but never started playing — likely a codec the browser can't decode.")
          setPhase('error')
        }, STALL_TIMEOUT_MS)

        cleanupRef.current = () => {
          clearTimeout(stallTimer)
          video.removeEventListener('loadedmetadata', onLoadedMetadata)
          video.removeEventListener('canplay', onCanPlay)
          video.removeEventListener('waiting', onWaiting)
          video.removeEventListener('stalled', onStalled)
          video.removeEventListener('error', onVideoError)
          video.removeEventListener('playing', onPlaying)
          cleanupRef.current = null
        }

        logEvent('tx', `Opening player: ${url.pathname}?${url.searchParams.toString()}`)
        player.load()
        void player.play()
      } catch (err) {
        if (cancelled) return
        const message = err instanceof ApiError ? err.message : String(err)
        logEvent('error', `Failed to start stream: ${message}`)
        setError(message)
        setPhase('error')
      }
    }

    void start()
    return () => {
      cancelled = true
      cleanupRef.current?.()
    }
  }, [phase, serial])

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [])

  const retry = () => {
    cleanupRef.current?.()
    playerRef.current?.destroy()
    playerRef.current = null
    setError(null)
    setPhase('waiting-online')
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Live view
        </span>
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">
          Camera stream
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Serial <code className="font-mono font-medium text-foreground">{serial}</code>
        </p>
      </div>

      <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
        {/* Always mounted, even before we're playing — mpegts.js requires
            attachMediaElement() to run before load(), which means the <video>
            must already exist in the DOM by the time the 'loading' phase
            effect runs. Rendering it only for phase === 'playing' left
            videoRef.current null at that point (IllegalStateException:
            HTMLMediaElement must be attached before load()!). */}
        <video
          ref={videoRef}
          className="aspect-video w-full bg-black"
          style={{ display: phase === 'playing' ? 'block' : 'none' }}
          autoPlay
          muted
          playsInline
          controls
        />
        {phase !== 'playing' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5 text-center">
            {phase === 'error' ? (
              <>
                <AlertTriangle className="size-8 text-destructive" strokeWidth={1.5} />
                <p className="text-sm font-semibold">Couldn't play the stream</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </>
            ) : (
              <>
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm font-semibold">
                  {phase === 'waiting-online'
                    ? 'Waiting for the camera to be online…'
                    : 'Opening the stream…'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Checking <code className="font-mono">/admin/device/{serial}</code> fresh, same as
                  the reference Android app does right before it opens a stream.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Radio className="size-3.5" />
        Format: MPEG-TS over Media Source Extensions, via mpegts.js — matches AndroidOpenDemo
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
