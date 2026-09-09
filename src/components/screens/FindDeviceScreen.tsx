import { Bluetooth } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FindDeviceScreenProps {
  serial: string
  scanning: boolean
  error: string | null
  onScan: () => void
}

export function FindDeviceScreen({ serial, scanning, error, onScan }: FindDeviceScreenProps) {
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Step 2 of 5
        </span>
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">
          Find it over Bluetooth
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Serial <code className="font-mono font-medium text-foreground">{serial}</code>
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-5 text-center">
        <div className="glow-primary flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Bluetooth className="size-8" />
        </div>
        <p className="max-w-[26ch] text-justify text-sm text-muted-foreground">
          Your browser will show its own picker — pick the camera from that list, then pairing
          continues automatically.
        </p>

        <div className="flex-1" />

        <Button onClick={onScan} disabled={scanning} size="lg" className="w-full">
          <span className="relative flex size-5 items-center justify-center">
            {scanning && (
              <>
                <span className="absolute inset-0 rounded-full bg-primary-foreground/50 animate-gc-pulse" />
                <span className="absolute inset-0 rounded-full bg-primary-foreground/50 animate-gc-pulse-delay-1" />
                <span className="absolute inset-0 rounded-full bg-primary-foreground/50 animate-gc-pulse-delay-2" />
              </>
            )}
            <Bluetooth className="relative size-4" />
          </span>
          {scanning ? 'Waiting for device picker…' : 'Find this camera over Bluetooth'}
        </Button>

        {error && (
          <p className="w-full rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
