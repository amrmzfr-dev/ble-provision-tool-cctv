import { ScanLine, X } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useQrScanner } from '@/hooks/useQrScanner'

interface QrScannerDialogProps {
  onResult: (text: string) => void
  onClose: () => void
}

export function QrScannerDialog({ onResult, onClose }: QrScannerDialogProps) {
  const { videoRef, error, start, stop } = useQrScanner((text) => {
    onResult(text)
    onClose()
  })

  useEffect(() => {
    start()
    return () => stop()
    // Deliberately mount-only: start/stop are recreated whenever `error` changes (it flows
    // through the onResult closure's identity), so depending on them would retry the camera
    // in a tight loop for as long as permission stays denied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 p-4">
      <div className="flex w-full max-w-sm items-center justify-between text-white">
        <span className="flex items-center gap-2 text-sm font-medium">
          <ScanLine className="size-4" />
          Point at the camera's serial number QR code
        </span>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
          <X />
        </Button>
      </div>

      <div className="relative w-full max-w-sm overflow-hidden rounded-lg border border-white/20">
        <video ref={videoRef} playsInline muted className="w-full" />
        <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/60" />
      </div>

      {error && (
        <p className="max-w-sm rounded-md bg-red-950 p-3 text-center text-sm text-red-300">
          Couldn't access the camera: {error}. Check that this page has camera permission, or enter
          the serial number manually instead.
        </p>
      )}
    </div>
  )
}
