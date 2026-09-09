import { Bluetooth, Loader2, Pencil, QrCode, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

export function DeviceScanner() {
  const [mode, setMode] = useState<ScanFilterMode>('manufacturer')
  const [namePrefix, setNamePrefix] = useState('')
  const [serial, setSerial] = useState('')
  const [manualEntry, setManualEntry] = useState(false)
  const [showQrScanner, setShowQrScanner] = useState(false)
  const { device, error, scanning, scan, reset } = useBleScan()

  const serialMatch = device ? deviceMatchesSerial(device.name, serial) : null

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bluetooth className="size-5" />
          Perodua charger camera — BLE pairing
        </CardTitle>
        <CardDescription>
          Step 1: scan the camera's serial number. Step 2: find it over Bluetooth.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            1. Camera serial number
          </span>

          {serial && !manualEntry ? (
            <div className="flex items-center justify-between rounded-md bg-zinc-100 px-3 py-2 dark:bg-zinc-900">
              <code className="font-mono text-sm">{serial}</code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setManualEntry(true)}
              >
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
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Or type the serial if the QR won't scan"
                  value={serial}
                  onChange={(e) => setSerial(normalizeSerial(e.target.value))}
                  className="h-10 flex-1 rounded-md border border-zinc-200 bg-transparent px-3 text-sm font-mono dark:border-zinc-800"
                />
              </div>
            </div>
          )}

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Required — the backend API identifies this camera by serial number
            (<code>/api/device/&lt;serial&gt;/...</code>), so this has to be the real serial off
            the sticker, not guessed from what Bluetooth advertises.
          </p>
        </div>

        <fieldset className="flex flex-col gap-2" disabled={scanning || !serial}>
          {MODES.map((m) => (
            <label
              key={m.value}
              className="flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 p-3 text-sm has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50 dark:border-zinc-800 dark:has-[:checked]:border-zinc-100 dark:has-[:checked]:bg-zinc-900 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
            >
              <input
                type="radio"
                name="scan-mode"
                value={m.value}
                checked={mode === m.value}
                disabled={!serial}
                onChange={() => setMode(m.value)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-zinc-900 dark:text-zinc-50">{m.label}</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">{m.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {mode === 'name-prefix' && (
          <input
            type="text"
            placeholder="e.g. ABCD"
            maxLength={4}
            value={namePrefix}
            disabled={!serial}
            onChange={(e) => setNamePrefix(e.target.value)}
            className="h-10 rounded-md border border-zinc-200 bg-transparent px-3 text-sm disabled:opacity-50 dark:border-zinc-800"
          />
        )}

        <Button onClick={() => scan(mode, namePrefix)} disabled={scanning || !serial} className="w-full">
          {scanning ? <Loader2 className="animate-spin" /> : <Bluetooth />}
          {scanning ? 'Waiting for device picker…' : 'Find this camera over Bluetooth'}
        </Button>
        {!serial && (
          <p className="-mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Scan or enter the serial number above first.
          </p>
        )}

        {error && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {device && (
          <div className="flex flex-col gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950">
            <div className="flex items-center justify-between">
              <span className="font-medium text-green-900 dark:text-green-200">Device found</span>
              <Badge variant={serialMatch ? 'success' : 'destructive'}>
                {serialMatch ? 'serial matches' : "serial doesn't match"}
              </Badge>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Advertised name: </span>
              <code className="font-mono">{device.name}</code>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Browser device id: </span>
              <code className="break-all font-mono text-xs">{device.id}</code>
            </div>
            {!serialMatch && (
              <p className="text-xs text-red-700 dark:text-red-300">
                This device's advertised name doesn't contain the serial you scanned. Wrong
                camera nearby, or the QR was misread — check both before continuing.
              </p>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Also note the characters before the serial in the advertised name — that's the
              4-character prefix this app still needs confirmed for the next phase.
            </p>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw />
              Scan again
            </Button>
          </div>
        )}
      </CardContent>

      {showQrScanner && (
        <QrScannerDialog
          onResult={(text) => {
            setSerial(normalizeSerial(text))
            setManualEntry(false)
          }}
          onClose={() => setShowQrScanner(false)}
        />
      )}
    </Card>
  )
}
