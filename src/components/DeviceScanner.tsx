import { Bluetooth, Loader2, QrCode, RotateCcw } from 'lucide-react'
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
  const [expectedSerial, setExpectedSerial] = useState('')
  const [showQrScanner, setShowQrScanner] = useState(false)
  const { device, error, scanning, scan, reset } = useBleScan()

  const guessedSerial = device && device.name.length > 4 ? device.name.slice(4) : null
  const serialMatch = device && expectedSerial ? deviceMatchesSerial(device.name, expectedSerial) : null

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bluetooth className="size-5" />
          Find the camera
        </CardTitle>
        <CardDescription>
          Phase 1: confirm the camera is visible and learn its advertised name format.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Expected serial number (optional)
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Scan the QR code, or type it in"
              value={expectedSerial}
              onChange={(e) => setExpectedSerial(e.target.value.toUpperCase())}
              className="h-10 flex-1 rounded-md border border-zinc-200 bg-transparent px-3 text-sm font-mono dark:border-zinc-800"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowQrScanner(true)}
              aria-label="Scan QR code"
            >
              <QrCode />
            </Button>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Scanning the sticker on the camera confirms you paired with the right one once found —
            it doesn't change how the search below runs.
          </p>
        </div>

        <fieldset className="flex flex-col gap-2" disabled={scanning}>
          {MODES.map((m) => (
            <label
              key={m.value}
              className="flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 p-3 text-sm has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50 dark:border-zinc-800 dark:has-[:checked]:border-zinc-100 dark:has-[:checked]:bg-zinc-900"
            >
              <input
                type="radio"
                name="scan-mode"
                value={m.value}
                checked={mode === m.value}
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
            onChange={(e) => setNamePrefix(e.target.value)}
            className="h-10 rounded-md border border-zinc-200 bg-transparent px-3 text-sm dark:border-zinc-800"
          />
        )}

        <Button onClick={() => scan(mode, namePrefix)} disabled={scanning} className="w-full">
          {scanning ? <Loader2 className="animate-spin" /> : <Bluetooth />}
          {scanning ? 'Waiting for device picker…' : 'Scan for camera'}
        </Button>

        {error && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {device && (
          <div className="flex flex-col gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950">
            <div className="flex items-center justify-between">
              <span className="font-medium text-green-900 dark:text-green-200">Device found</span>
              <Badge variant="success">picked</Badge>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Advertised name: </span>
              <code className="font-mono">{device.name}</code>
            </div>
            {guessedSerial && (
              <div>
                <span className="text-zinc-500 dark:text-zinc-400">Guessed serial (name minus first 4 chars): </span>
                <code className="font-mono">{guessedSerial}</code>
              </div>
            )}
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Browser device id: </span>
              <code className="break-all font-mono text-xs">{device.id}</code>
            </div>
            {serialMatch !== null && (
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400">Matches scanned serial: </span>
                <Badge variant={serialMatch ? 'success' : 'destructive'}>
                  {serialMatch ? 'yes' : 'no — wrong camera?'}
                </Badge>
              </div>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Check: does the guessed serial match the sticker on the camera? Note the 4 characters
              dropped — that is the name prefix Phase 1 is looking for.
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
          onResult={(text) => setExpectedSerial(normalizeSerial(text))}
          onClose={() => setShowQrScanner(false)}
        />
      )}
    </Card>
  )
}
