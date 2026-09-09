import { Keyboard, QrCode, ScanLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useQrScanner } from '@/hooks/useQrScanner'
import { normalizeSerial } from '@/lib/ble/serial'

interface ScanSerialScreenProps {
  onSerialConfirmed: (serial: string) => void
}

type Mode = 'idle' | 'camera' | 'manual'

export function ScanSerialScreen({ onSerialConfirmed }: ScanSerialScreenProps) {
  const [mode, setMode] = useState<Mode>('idle')
  const [manualSerial, setManualSerial] = useState('')
  const { videoRef, error, start, stop } = useQrScanner((text) => {
    onSerialConfirmed(normalizeSerial(text))
  })

  useEffect(() => {
    if (mode !== 'camera') return
    start()
    return () => stop()
    // Deliberately mode-only: start/stop are recreated on every render (their identity flows
    // through the onResult closure), so depending on them here would retry the camera in a
    // loop while permission stays denied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Step 1 of 3
        </span>
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">
          Scan the camera's serial
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Find the QR sticker on the camera, then scan it or type it in.
        </p>
      </div>

      {mode === 'idle' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="glow-primary flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-destructive text-primary-foreground">
            <QrCode className="size-8" />
          </div>
          <p className="max-w-[26ch] text-center text-sm text-muted-foreground">
            Ready when you are — this opens your camera to scan the QR code.
          </p>
          <Button size="lg" className="w-full" onClick={() => setMode('camera')}>
            <QrCode />
            Scan the QR code
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setMode('manual')}>
            <Keyboard />
            Type the serial instead
          </Button>
        </div>
      )}

      {mode === 'manual' && (
        <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <span className="text-sm font-semibold uppercase tracking-tight">Enter it by hand</span>
          <Input
            autoFocus
            placeholder="e.g. BL08809RAG33B84"
            value={manualSerial}
            onChange={(e) => setManualSerial(normalizeSerial(e.target.value))}
          />
          <Button disabled={!manualSerial} onClick={() => onSerialConfirmed(manualSerial)} size="lg">
            Continue
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => setMode('idle')}>
            Back
          </Button>
        </div>
      )}

      {mode === 'camera' && (
        <>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border bg-[#0c0c0c]">
            <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />
            <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-primary" />
            <span className="pointer-events-none absolute bottom-5 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 font-mono text-[10px] font-medium tracking-[0.1em] text-white uppercase">
              <ScanLine className="size-3.5" />
              Looking for a code…
            </span>
          </div>

          {error && (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              Couldn't access the camera: {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setMode('idle')}>
              Cancel
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setMode('manual')}>
              <Keyboard />
              Type it instead
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
