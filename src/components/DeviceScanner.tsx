import {
  AlertTriangle,
  Bluetooth,
  CheckCircle2,
  ListFilter,
  Pencil,
  QrCode,
  Radar,
  RotateCcw,
  Tag,
} from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QrScannerDialog } from '@/components/QrScannerDialog'
import { useBleScan } from '@/hooks/useBleScan'
import { deviceMatchesSerial, normalizeSerial } from '@/lib/ble/serial'
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

function StepIcon({
  icon: Icon,
  active,
}: {
  icon: ComponentType<{ className?: string }>
  active: boolean
}) {
  return (
    <div
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors',
        active
          ? 'glow-primary bg-gradient-to-br from-primary to-destructive text-primary-foreground'
          : 'bg-secondary text-muted-foreground',
      )}
    >
      <Icon className="size-5" />
    </div>
  )
}

export function DeviceScanner() {
  const [mode, setMode] = useState<ScanFilterMode>('manufacturer')
  const [namePrefix, setNamePrefix] = useState('')
  const [serial, setSerial] = useState('')
  const [manualEntry, setManualEntry] = useState(false)
  const [showQrScanner, setShowQrScanner] = useState(false)
  const { device, error, scanning, scan, reset } = useBleScan()

  const serialMatch = device ? deviceMatchesSerial(device.name, serial) : null
  const activeMode = MODES.find((m) => m.value === mode)!

  return (
    <div className="flex flex-col gap-5">
      {/* Scoped to just the two step rows, so the connector line doesn't
          stretch through the result card below once that appears (that
          would grow the outer container and drag its bottom edge down). */}
      <div className="relative flex flex-col gap-5">
        <div className="absolute top-11 bottom-11 left-[21px] w-px bg-border" />

        <div className="flex gap-4">
          <StepIcon icon={QrCode} active={Boolean(serial)} />
          <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <span className="text-sm font-semibold uppercase tracking-tight">
              Camera serial number
            </span>

            {serial && !manualEntry ? (
              <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5">
                <code className="font-mono text-sm font-medium">{serial}</code>
                <Button type="button" variant="ghost" size="sm" onClick={() => setManualEntry(true)}>
                  <Pencil />
                  Change
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button type="button" onClick={() => setShowQrScanner(true)} className="w-full">
                  <QrCode />
                  Scan the QR code on the camera
                </Button>
                <Input
                  placeholder="Or type the serial if the QR won't scan"
                  value={serial}
                  onChange={(e) => setSerial(normalizeSerial(e.target.value))}
                />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Required — the backend API identifies this camera by serial number
              (<code className="font-mono">/api/device/&lt;serial&gt;/...</code>), so this has to
              be the real serial off the sticker, not guessed from what Bluetooth advertises.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <StepIcon icon={Bluetooth} active={scanning} />
          <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <span className="text-sm font-semibold uppercase tracking-tight">
              Find it over Bluetooth
            </span>

            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Scan mode">
              {MODES.map((m) => {
                const isSelected = mode === m.value
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={scanning || !serial}
                    onClick={() => setMode(m.value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      isSelected
                        ? 'border-primary bg-accent text-accent-foreground'
                        : 'border-border text-muted-foreground hover:bg-secondary',
                    )}
                  >
                    <m.icon className="size-5" />
                    <span className="text-[11px] leading-tight font-semibold uppercase">
                      {m.label}
                    </span>
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
                disabled={!serial}
                onChange={(e) => setNamePrefix(e.target.value)}
              />
            )}

            <Button onClick={() => scan(mode, namePrefix)} disabled={scanning || !serial} size="lg">
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
            {!serial && (
              <p className="text-center text-xs text-muted-foreground">
                Scan or enter the serial number above first.
              </p>
            )}

            {error && (
              <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>
      </div>

      {device && (
        <div
          className={cn(
            'flex flex-col gap-3 rounded-2xl p-5',
            serialMatch
              ? 'glow-lime bg-lime text-[#0c0c0c]'
              : 'glow-destructive bg-destructive text-white dark:text-[#0c0c0c]',
          )}
        >
          <div className="flex items-center gap-3">
            {serialMatch ? (
              <CheckCircle2 className="size-8 shrink-0" strokeWidth={1.5} />
            ) : (
              <AlertTriangle className="size-8 shrink-0" strokeWidth={1.5} />
            )}
            <div className="flex flex-col">
              <span className="text-lg leading-tight font-black uppercase tracking-tight">
                Device found
              </span>
              <Badge variant="outline" className="w-fit border-current/30 text-current">
                {serialMatch ? 'serial matches' : "serial doesn't match"}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <span>
              <span className="opacity-70">Advertised name: </span>
              <code className="font-mono font-medium">{device.name}</code>
            </span>
            <span className="break-all">
              <span className="opacity-70">Browser device id: </span>
              <code className="font-mono text-xs font-medium">{device.id}</code>
            </span>
          </div>
          {!serialMatch && (
            <p className="text-xs font-medium">
              This device's advertised name doesn't contain the serial you scanned. Wrong camera
              nearby, or the QR was misread — check both before continuing.
            </p>
          )}
          <p className="text-xs opacity-70">
            Also note the characters before the serial in the advertised name — that's the
            4-character prefix this app still needs confirmed for the next phase.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="self-start border-current/30 bg-transparent"
          >
            <RotateCcw />
            Scan again
          </Button>
        </div>
      )}

      {showQrScanner && (
        <QrScannerDialog
          onResult={(text) => {
            setSerial(normalizeSerial(text))
            setManualEntry(false)
          }}
          onClose={() => setShowQrScanner(false)}
        />
      )}
    </div>
  )
}
