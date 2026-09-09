import jsQR from 'jsqr'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

interface UseQrScannerResult {
  videoRef: RefObject<HTMLVideoElement | null>
  error: string | null
  start: () => Promise<void>
  stop: () => void
  /** Normalized [0,1] point in the camera's own frame - see handleTapToFocus in ScanSerialScreen for converting a tap position into this. */
  focusAt: (x: number, y: number) => void
}

export function useQrScanner(onResult: (text: string) => void): UseQrScannerResult {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const tick = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(frame.data, frame.width, frame.height)

    if (code && code.data.trim()) {
      stop()
      onResult(code.data.trim())
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [onResult, stop])

  const start = useCallback(async () => {
    setError(null)
    try {
      // Small QR codes need real resolution to resolve - the default
      // getUserMedia stream is often ~640x480, nowhere near enough detail
      // for a small code at arm's length. `focusMode` isn't in TypeScript's
      // DOM types (still an experimental Image Capture extension) but
      // Chrome on Android honors it; unsupported constraints are just
      // ignored rather than erroring, so this is safe everywhere.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          ...({ focusMode: 'continuous' } as MediaTrackConstraints),
        },
      })
      streamRef.current = stream

      const [track] = stream.getVideoTracks()
      try {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
      } catch {
        // Not supported on this device/browser - the initial getUserMedia
        // constraint above is the fallback attempt, and plain autofocus is
        // still better than nothing if neither takes.
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [tick])

  const focusAt = useCallback((x: number, y: number) => {
    const [track] = streamRef.current?.getVideoTracks() ?? []
    if (!track) return

    // pointsOfInterest biases continuous AF/AE toward this point rather than
    // locking focus there outright - same experimental Image Capture
    // extension as focusMode, so this is a best-effort nudge, not a
    // guaranteed refocus. Fails silently where unsupported (most non-Android
    // browsers, including Bluefy on iOS).
    track
      .applyConstraints({
        advanced: [{ pointsOfInterest: [{ x, y }] } as MediaTrackConstraintSet],
      })
      .catch(() => {})
  }, [])

  useEffect(() => stop, [stop])

  return { videoRef, error, start, stop, focusAt }
}
