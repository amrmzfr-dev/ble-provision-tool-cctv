import jsQR from 'jsqr'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

interface UseQrScannerResult {
  videoRef: RefObject<HTMLVideoElement | null>
  error: string | null
  start: () => Promise<void>
  stop: () => void
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [tick])

  useEffect(() => stop, [stop])

  return { videoRef, error, start, stop }
}
