import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BackendHandoffScreen } from '@/components/screens/BackendHandoffScreen'
import { FindDeviceScreen } from '@/components/screens/FindDeviceScreen'
import { PairingScreen } from '@/components/screens/PairingScreen'
import { ScanSerialScreen } from '@/components/screens/ScanSerialScreen'
import { StreamScreen } from '@/components/screens/StreamScreen'
import { WifiCredentialsScreen } from '@/components/screens/WifiCredentialsScreen'
import { useBleScan } from '@/hooks/useBleScan'
import { useSwipe } from '@/hooks/useSwipe'
import { deviceMatchesSerial } from '@/lib/ble/serial'
import { clearPairingState, loadPairingState, savePairingState } from '@/lib/sessionState'
import { cn } from '@/lib/utils'

export type Step = 'scan' | 'find' | 'wifi' | 'pairing' | 'backend' | 'stream'
const STEPS: Step[] = ['scan', 'find', 'wifi', 'pairing', 'backend']

function StepDots({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i === activeIndex ? 'w-4 bg-primary' : 'w-1.5 bg-border',
          )}
        />
      ))}
    </div>
  )
}

// Restores wherever the user was within a refresh, but not across actually
// closing the tab/app (loadPairingState reads sessionStorage - see
// lib/sessionState.ts). 'find'/'wifi'/'pairing' resuming without a live BLE
// device is still safe: the guard effect below bounces 'pairing' back to
// 'find' when there's no device, and 'find'/'wifi' just show their normal
// not-yet-scanned state otherwise.
const initialSession = loadPairingState()

export function DeviceScanner() {
  const [step, setStep] = useState<Step>(initialSession?.step ?? 'scan')
  const [serial, setSerial] = useState(initialSession?.serial ?? '')
  const [wifiSsid, setWifiSsid] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')
  const [wifiError, setWifiError] = useState<string | null>(null)
  const [backendNotified, setBackendNotified] = useState(initialSession?.backendNotified ?? false)
  const { device, error, scanning, scan, reset } = useBleScan()

  // 'stream' isn't a dot of its own - it's a sub-view reached from 'backend'
  // (via "View Stream"), so it shares that dot's index. Without this,
  // resuming a session saved mid-stream looks up STEPS.indexOf('stream'),
  // gets -1, and both previewIndex and STEPS[previewIndex] end up blank
  // until a swipe nudges the index back into range.
  const realIndex = STEPS.indexOf(step === 'stream' ? 'backend' : step)
  // Which step's content is actually being shown - independent of `step`
  // (real progress) so a swipe can browse ahead to preview a step that
  // hasn't been reached yet, or back to review one already passed, without
  // touching any real BLE/network state. This renders the SAME real screen
  // component either way (so what a user sees while previewing is exactly
  // what they'll actually get) - it's just wrapped non-interactively, and
  // PairingScreen/BackendHandoffScreen additionally get previewOnly to skip
  // the mount-time effect that would otherwise try a real BLE handshake or
  // a real network poll before its step is actually reached for real.
  const [previewIndex, setPreviewIndex] = useState(realIndex)

  // Real progress always wins - the moment something actually happens
  // (a serial gets confirmed, a device is found, ...), snap the view back
  // to it rather than leaving the user stranded on a stale preview.
  useEffect(() => {
    setPreviewIndex(STEPS.indexOf(step === 'stream' ? 'backend' : step))
  }, [step])

  // Found -> straight to WiFi entry, no separate confirmation screen. The
  // browser's own device picker already doubles as manual confirmation.
  useEffect(() => {
    if (device && step === 'find') setStep('wifi')
  }, [device, step])

  // Remember where we are on every step change, so a refresh resumes right
  // here instead of bouncing back to the QR scan. Cleared on an actual
  // "done"/reset (goHome) - see lib/sessionState.ts for why a real tab/app
  // close still starts fresh regardless.
  useEffect(() => {
    savePairingState({ serial, step, backendNotified })
  }, [step, serial, backendNotified])

  // A reload has no live GATT handle. If something routes back into
  // 'pairing' without one (e.g. "fix WiFi & retry" after resuming from a
  // closed tab), there's nothing to pair with - send back to re-discover the
  // device over Bluetooth instead of rendering a dead screen.
  useEffect(() => {
    if (step === 'pairing' && !device) setStep('find')
  }, [step, device])

  const serialMatch = device ? deviceMatchesSerial(device.name, serial) : false

  const goHome = () => {
    clearPairingState()
    reset()
    setSerial('')
    setWifiSsid('')
    setWifiPassword('')
    setWifiError(null)
    setBackendNotified(false)
    setStep('scan')
  }

  const goBack = () => {
    if (step === 'find') setStep('scan')
    if (step === 'wifi') {
      reset()
      setStep('find')
    }
  }

  // Pure view navigation - never mutates real step/device/BLE state, so
  // swiping through the whole flow to see what's coming is always safe,
  // completed or not.
  const swipeHandlers = useSwipe(
    () => setPreviewIndex((i) => Math.min(i + 1, STEPS.length - 1)),
    () => setPreviewIndex((i) => Math.max(i - 1, 0)),
  )

  const isViewingRealStep = previewIndex === realIndex
  // Same reason as realIndex above: 'stream' has no dot/index of its own, so
  // STEPS[previewIndex] can never actually equal 'stream'. Fall back to the
  // real `step` whenever we're viewing real progress (not a preview) so the
  // stream screen genuinely renders on resume instead of showing 'backend'.
  const previewedStep: Step = isViewingRealStep ? step : STEPS[previewIndex]
  // Only meaningful ahead of real progress - reviewing an already-completed
  // step needs no such reminder, there's nothing left to finish there.
  const previewIncomplete = !isViewingRealStep && previewIndex > realIndex

  const renderStep = (s: Step) => {
    switch (s) {
      case 'scan':
        return (
          <ScanSerialScreen
            onSerialConfirmed={(sVal) => {
              setSerial(sVal)
              setStep('find')
            }}
          />
        )
      case 'find':
        return <FindDeviceScreen serial={serial} scanning={scanning} error={error} onScan={(mode) => scan(mode)} />
      case 'wifi':
        return (
          <WifiCredentialsScreen
            deviceName={device?.name ?? serial}
            serialMatch={serialMatch}
            initialError={wifiError}
            onSubmit={(ssid, password) => {
              setWifiSsid(ssid)
              setWifiPassword(password)
              setWifiError(null)
              setStep('pairing')
            }}
          />
        )
      case 'pairing':
        return (
          <PairingScreen
            device={device?.device}
            serial={serial}
            ssid={wifiSsid}
            password={wifiPassword}
            onBack={() => setStep('wifi')}
            onSuccess={(result, notified) => {
              setBackendNotified(notified)
              if (result.joinResultCode === 0) {
                setStep('backend')
              } else {
                setWifiError(result.joinResultText)
                setStep('wifi')
              }
            }}
            previewOnly={s !== step}
          />
        )
      case 'backend':
        return (
          <BackendHandoffScreen
            serial={serial}
            alreadyNotified={backendNotified}
            onDone={goHome}
            onRetryWifi={() => setStep('wifi')}
            onViewStream={() => setStep('stream')}
            onCancel={goHome}
            previewOnly={s !== step}
          />
        )
      case 'stream':
        return <StreamScreen serial={serial} onBack={() => setStep('backend')} />
    }
  }

  return (
    <div className="relative flex min-h-[560px] flex-1 flex-col gap-4">
      <div className="flex h-8 items-center justify-between">
        {isViewingRealStep && (step === 'find' || step === 'wifi') ? (
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back" className="-ml-2">
            <ChevronLeft />
          </Button>
        ) : !isViewingRealStep && previewIndex > 0 ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPreviewIndex((i) => Math.max(i - 1, 0))}
            aria-label="Back"
            className="-ml-2"
          >
            <ChevronLeft />
          </Button>
        ) : (
          <span />
        )}
        <StepDots activeIndex={previewIndex} />
      </div>

      <div key={step} className="flex flex-1 touch-pan-y flex-col animate-in" {...swipeHandlers}>
        {/* Previewing renders the exact same real screen, just inert - a
            step that hasn't been reached yet (e.g. 'pairing' with no device
            found) shows precisely what it will look like, it just can't be
            interacted with until it's actually reached in order. */}
        <div
          className={cn('flex flex-1 flex-col', !isViewingRealStep && 'opacity-75')}
          // inert (not just pointer-events-none) - blocks keyboard typing
          // into an autoFocus'd input too, which pointer-events alone
          // doesn't: focus/keystrokes aren't pointer interactions, so a
          // field that autofocuses on mount was still typeable during
          // preview even though clicking it was blocked.
          inert={!isViewingRealStep}
        >
          {renderStep(previewedStep)}
        </div>
      </div>

      {/* Absolutely positioned, no auto-dismiss timer needed - it's derived
          straight from previewIndex vs realIndex, so it just stops
          rendering the moment either changes. Never shifts the card above
          it. A plain reminder, not an error: nothing's gone wrong, this
          step just isn't unlocked for real yet. */}
      {previewIncomplete && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-4">
          <div className="animate-in rounded-full border border-border bg-card px-4 py-2 text-center text-xs font-medium text-muted-foreground shadow-lg">
            Complete the steps before this one first to actually get here
          </div>
        </div>
      )}
    </div>
  )
}
