import { Bluetooth, Check, Copy, Moon, RotateCcw, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useBleScan } from '@/hooks/useBleScan'
import { useTheme } from '@/hooks/useTheme'
import { PROVISION_STAGE_LABEL, readDeviceSerial, type ProvisionStage } from '@/lib/ble/provision'
import { BleUnavailableError } from '@/lib/ble/types'

type ReadState =
  | { name: 'idle' }
  | { name: 'reading'; stage: ProvisionStage }
  | { name: 'done'; serial: string }
  | { name: 'error'; message: string }

/**
 * A pure lookup tool, not a pairing flow - it doesn't send WiFi credentials,
 * doesn't talk to the backend, and doesn't lead anywhere else. It exists so
 * anyone can point at a Dahua device nearby and see what it actually is
 * (advertised name + real serial), nothing more. Deliberately no login for
 * the same reason: there's no backend call here for a login to protect.
 * Routed to from main.tsx by pathname, same pattern as /dashboard.
 */
export function SerialCheckApp() {
  const { theme, toggleTheme } = useTheme()
  const { device, error: scanError, scanning, scan, reset: resetScan } = useBleScan()
  const [state, setState] = useState<ReadState>({ name: 'idle' })
  const [copied, setCopied] = useState(false)

  const startScan = async () => {
    setState({ name: 'idle' })
    await scan('manufacturer')
  }

  const readSerial = async (bleDevice: BluetoothDevice) => {
    setState({ name: 'reading', stage: 'connecting' })
    try {
      const serial = await readDeviceSerial(bleDevice, (stage) => setState({ name: 'reading', stage }))
      setState({ name: 'done', serial })
    } catch (err) {
      setState({ name: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  // useBleScan's picker resolves, then this fires once to actually read the
  // serial. Gated on state.name === 'idle' so it never re-fires while a read
  // is already in flight or finished for this device.
  useEffect(() => {
    if (device && state.name === 'idle') {
      void readSerial(device.device)
    }
    // readSerial's identity changes every render (it closes over setState
    // calls, not over device) - depending on it here would fire the effect
    // on every state change instead of just when a new device is picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, state.name])

  const startOver = () => {
    resetScan()
    setState({ name: 'idle' })
    setCopied(false)
  }

  const copySerial = async (serial: string) => {
    try {
      await navigator.clipboard.writeText(serial)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API can refuse (insecure context, denied permission) -
      // the serial is still selectable text either way, so this isn't fatal.
    }
  }

  const bleUnavailable = !navigator.bluetooth ? new BleUnavailableError().message : null

  return (
    <div className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <div className="relative mx-auto flex max-w-md flex-col gap-6 px-5 pt-4 pb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="glow-primary flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Bluetooth className="size-6" />
            </div>
            <div>
              <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Perodua smart charger
              </span>
              <h1 className="text-xl leading-[0.95] font-black tracking-tight uppercase">Dahua Scanner</h1>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </div>

        <div className="flex min-h-[420px] flex-1 flex-col gap-4">
          {(state.name === 'idle' || state.name === 'error') && !scanning && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-5 text-center">
              <div className="glow-primary flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Bluetooth className="size-8" />
              </div>
              {bleUnavailable ? (
                <p className="w-full rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  {bleUnavailable}
                </p>
              ) : (
                <>
                  <Button size="lg" className="w-full" onClick={startScan}>
                    <Bluetooth />
                    Scan for Dahua devices
                  </Button>
                  <button
                    type="button"
                    onClick={() => scan('all-devices')}
                    className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Show every nearby Bluetooth device instead
                  </button>
                </>
              )}

              {(scanError || state.name === 'error') && (
                <p className="w-full rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  {scanError ?? (state.name === 'error' ? state.message : '')}
                </p>
              )}
            </div>
          )}

          {scanning && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-5 text-center">
              <span className="relative flex size-16 items-center justify-center">
                <span className="absolute inset-0 rounded-2xl bg-primary/50 animate-gc-pulse" />
                <span className="absolute inset-0 rounded-2xl bg-primary/50 animate-gc-pulse-delay-1" />
                <Bluetooth className="relative size-8 text-primary" />
              </span>
              <p className="text-sm text-muted-foreground">Waiting for the device picker…</p>
            </div>
          )}

          {state.name === 'reading' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-5 text-center">
              <span className="relative flex size-16 items-center justify-center">
                <span className="absolute inset-0 rounded-2xl bg-primary/50 animate-gc-pulse" />
                <span className="absolute inset-0 rounded-2xl bg-primary/50 animate-gc-pulse-delay-1" />
                <Bluetooth className="relative size-8 text-primary" />
              </span>
              <p className="text-sm text-muted-foreground">{PROVISION_STAGE_LABEL[state.stage]}</p>
            </div>
          )}

          {state.name === 'done' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-2xl border border-border bg-card p-5 text-center">
              {device && (
                <span className="text-xs font-medium text-muted-foreground">
                  Advertised as <span className="text-foreground">{device.name}</span>
                </span>
              )}
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Dahua serial number
                </span>
                <button
                  type="button"
                  onClick={() => copySerial(state.serial)}
                  className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-6 font-mono text-2xl font-black tracking-wider break-all text-foreground select-all hover:bg-muted"
                >
                  {state.serial}
                </button>
              </div>
              <Button size="lg" className="w-full" onClick={() => copySerial(state.serial)}>
                {copied ? <Check /> : <Copy />}
                {copied ? 'Copied' : 'Copy serial'}
              </Button>
              <Button variant="outline" className="w-full" onClick={startOver}>
                <RotateCcw />
                Scan again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
