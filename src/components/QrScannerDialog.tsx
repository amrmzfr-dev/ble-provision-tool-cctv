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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0c0c0c]/95 p-4">
      <div className="flex w-full max-w-sm items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.1em] text-white/70 uppercase">
          <ScanLine className="size-4" />
          Scan the serial QR code
        </span>
        <Button
          variant="secondary"
          size="icon"
          onClick={onClose}
          className="size-9 border border-white/15 bg-white/10 text-white hover:bg-white/15"
        >
          <X />
        </Button>
      </div>

      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/15">
        <video ref={videoRef} playsInline muted className="w-full" />
        <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-primary" />
      </div>

      {error && (
        <p className="max-w-sm rounded-xl bg-destructive/15 p-3 text-center text-sm text-destructive">
          Couldn't access the camera: {error}. Check that this page has camera permission, or enter
          the serial number manually instead.
        </p>
      )}
    </div>
  )
}
