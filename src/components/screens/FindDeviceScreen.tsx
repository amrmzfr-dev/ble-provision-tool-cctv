import { Bluetooth, ListFilter, Radar, Tag } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ScanFilterMode } from '@/lib/ble/types'

const MODES: { value: ScanFilterMode; label: string; icon: ComponentType<{ className?: string }>; hint: string }[] = [
  {
    value: 'manufacturer',
    label: 'Manufacturer ID',
    icon: Radar,
    hint: 'Most selective. Requires Chrome 92+; not confirmed working in Bluefy yet.',
  },
  {
    value: 'name-prefix',
    label: 'Name prefix',
    icon: Tag,
    hint: 'Use once you know the 4-character prefix in front of the serial number.',
  },
  {
    value: 'all-devices',
    label: 'Show all',
    icon: ListFilter,
    hint: 'Guaranteed fallback. Works on Bluefy. You pick the camera by eye from the system list.',
  },
]

interface FindDeviceScreenProps {
  serial: string
  scanning: boolean
  error: string | null
  onScan: (mode: ScanFilterMode, namePrefix?: string) => void
}

export function FindDeviceScreen({ serial, scanning, error, onScan }: FindDeviceScreenProps) {
  const [mode, setMode] = useState<ScanFilterMode>('manufacturer')
  const [namePrefix, setNamePrefix] = useState('')
  const activeMode = MODES.find((m) => m.value === mode)!

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Step 2 of 6
        </span>
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">
          Find it over Bluetooth
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Serial <code className="font-mono font-medium text-foreground">{serial}</code>
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Scan mode">
          {MODES.map((m) => {
            const isSelected = mode === m.value
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={scanning}
                onClick={() => setMode(m.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  isSelected
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border text-muted-foreground hover:bg-secondary',
                )}
              >
                <m.icon className="size-5" />
                <span className="text-[11px] leading-tight font-semibold uppercase">{m.label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">{activeMode.hint}</p>

        {mode === 'name-prefix' && (
          <Input
            placeholder="e.g. ABCD"
            maxLength={4}
            value={namePrefix}
            onChange={(e) => setNamePrefix(e.target.value)}
          />
        )}

        <div className="flex-1" />

        <Button onClick={() => onScan(mode, namePrefix)} disabled={scanning} size="lg">
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
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
