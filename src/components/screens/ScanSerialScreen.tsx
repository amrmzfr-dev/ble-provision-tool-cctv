import { Keyboard, ScanLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useQrScanner } from '@/hooks/useQrScanner'
import { normalizeSerial } from '@/lib/ble/serial'

interface ScanSerialScreenProps {
  onSerialConfirmed: (serial: string) => void
}

export function ScanSerialScreen({ onSerialConfirmed }: ScanSerialScreenProps) {
  const [manualEntry, setManualEntry] = useState(false)
  const [manualSerial, setManualSerial] = useState('')
  const { videoRef, error, start, stop } = useQrScanner((text) => {
    onSerialConfirmed(normalizeSerial(text))
  })

  useEffect(() => {
    if (manualEntry) {
      stop()
      return
    }
    start()
    return () => stop()
    // Deliberately mount/manualEntry-only: start/stop are recreated on every render (their
    // identity flows through the onResult closure), so depending on them here would retry the
    // camera in a loop while permission stays denied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualEntry])

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
          Find the QR sticker on the camera and point your phone at it.
        </p>
      </div>

      {manualEntry ? (
        <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <span className="text-sm font-semibold uppercase tracking-tight">Enter it by hand</span>
          <Input
            autoFocus
            placeholder="e.g. BL08809RAG33B84"
            value={manualSerial}
            onChange={(e) => setManualSerial(normalizeSerial(e.target.value))}
          />
          <Button
            disabled={!manualSerial}
            onClick={() => onSerialConfirmed(manualSerial)}
            size="lg"
          >
            Continue
          </Button>
        </div>
      ) : (
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border bg-[#0c0c0c]">
          <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />
          <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-primary" />
          <span className="pointer-events-none absolute bottom-5 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 font-mono text-[10px] font-medium tracking-[0.1em] text-white uppercase">
            <ScanLine className="size-3.5" />
            Looking for a code…
          </span>
        </div>
      )}

      {error && !manualEntry && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          Couldn't access the camera: {error}
        </p>
      )}

      <Button
        variant="outline"
        onClick={() => setManualEntry((v) => !v)}
        className="w-full"
      >
        <Keyboard />
        {manualEntry ? 'Use the camera instead' : "Can't scan it? Type the serial"}
      </Button>
    </div>
  )
}
