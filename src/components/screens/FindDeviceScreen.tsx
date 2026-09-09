import { Bluetooth } from 'lucide-react'
import { HelpTip } from '@/components/HelpTip'
import { Button } from '@/components/ui/button'

interface FindDeviceScreenProps {
  serial: string
  scanning: boolean
  error: string | null
  onScan: (mode: 'manufacturer' | 'all-devices') => void
}

/**
 * Primary button filters the browser's own device picker down to Dahua
 * devices only (manufacturer ID, see useBleScan.ts's 'manufacturer' mode) -
 * this can't skip the picker itself (Web Bluetooth always requires a user
 * gesture on a real chooser dialog, a hard spec-level rule with no
 * workaround, same as every other website), but it does mean the list is
 * usually just the one camera instead of every nearby BLE device. Falls
 * back to showing everything in case manufacturer-data filtering doesn't
 * work on this browser (flagged as unverified on Bluefy/iOS in the
 * original plan).
 */
export function FindDeviceScreen({ serial, scanning, error, onScan }: FindDeviceScreenProps) {
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Step 2 of 5
        </span>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">
            Find it over Bluetooth
          </h2>
          <HelpTip title="Is it in pairing mode?" imageSrc="/help/pairing-led.jpg" imageAlt="The camera's status LED, located just below its lens, blinking green">
            <p>
              Look for the small LED just below the camera's lens. If it's{' '}
              <strong className="text-foreground">blinking green quickly</strong>, the camera is in
              Bluetooth pairing mode and ready to be found. If it isn't blinking, it may need a
              power cycle or a physical reset before it will advertise over Bluetooth again.
            </p>
          </HelpTip>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Serial <code className="font-mono font-medium text-foreground">{serial}</code>
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-5 text-center">
        <div className="glow-primary flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Bluetooth className="size-8" />
        </div>
        <p className="max-w-[26ch] text-justify text-sm text-muted-foreground">
          Your browser will show its own picker, pre-filtered to just this camera's kind of
          device. Pick it from that list, then pairing continues automatically.
        </p>

        <div className="flex-1" />

        <Button onClick={() => onScan('manufacturer')} disabled={scanning} size="lg" className="w-full">
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

        <button
          type="button"
          onClick={() => onScan('all-devices')}
          disabled={scanning}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Not seeing it? Show every nearby Bluetooth device instead
        </button>

        {error && (
          <p className="w-full rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
