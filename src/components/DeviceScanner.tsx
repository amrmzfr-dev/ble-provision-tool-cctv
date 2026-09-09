import { Bluetooth, Pencil, QrCode, RotateCcw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QrScannerDialog } from '@/components/QrScannerDialog'
import { useBleScan } from '@/hooks/useBleScan'
import { deviceMatchesSerial, normalizeSerial } from '@/lib/ble/serial'
import type { ScanFilterMode } from '@/lib/ble/types'

const MODES: { value: ScanFilterMode; label: string; hint: string }[] = [
  {
    value: 'manufacturer',
    label: 'Dahua manufacturer ID',
    hint: 'Most selective. Requires Chrome 92+; not confirmed working in Bluefy yet.',
  },
  {
    value: 'name-prefix',
    label: 'Name prefix',
    hint: 'Use once you know the 4-character prefix in front of the serial number.',
  },
  {
    value: 'all-devices',
    label: 'Show every nearby device',
    hint: 'Guaranteed fallback. Works on Bluefy. You pick the camera by eye from the system list.',
  },
]

function StepLabel({ step, children }: { step: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[11px] font-semibold text-primary-foreground">
        {step}
      </span>
      <span className="text-sm font-semibold uppercase tracking-tight">{children}</span>
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <StepLabel step={1}>Camera serial number</StepLabel>

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
          (<code className="font-mono">/api/device/&lt;serial&gt;/...</code>), so this has to be
          the real serial off the sticker, not guessed from what Bluetooth advertises.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <StepLabel step={2}>Find it over Bluetooth</StepLabel>

        <fieldset className="flex flex-col gap-2" disabled={scanning || !serial}>
          {MODES.map((m) => (
            <label
              key={m.value}
              className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
            >
              <input
                type="radio"
                name="scan-mode"
                value={m.value}
                checked={mode === m.value}
                disabled={!serial}
                onChange={() => setMode(m.value)}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

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
          <span className="relative flex items-center">
            {scanning && (
              <span className="absolute inset-0 -m-1 rounded-full bg-primary-foreground/40 animate-gc-pulse" />
            )}
            <Bluetooth className="relative" />
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

      {device && (
        <div
          className={
            serialMatch
              ? 'flex flex-col gap-3 rounded-2xl bg-lime p-5 text-[#0c0c0c]'
              : 'flex flex-col gap-3 rounded-2xl bg-destructive p-5 text-white dark:text-[#0c0c0c]'
          }
        >
          <div className="flex items-center justify-between">
            <span className="text-lg font-black uppercase tracking-tight">Device found</span>
            <Badge variant="outline" className="border-current/30 text-current">
              {serialMatch ? 'serial matches' : "serial doesn't match"}
            </Badge>
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
