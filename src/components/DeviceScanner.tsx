import { ChevronLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import { clearSessionState, loadSessionState, saveSessionState } from '@/lib/sessionState'
import { cn } from '@/lib/utils'

type Step = 'scan' | 'find' | 'wifi' | 'pairing' | 'backend' | 'stream'
const STEPS: Step[] = ['scan', 'find', 'wifi', 'pairing', 'backend']

function StepDots({ step }: { step: Step }) {
  const index = STEPS.indexOf(step)
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i === index ? 'w-4 bg-primary' : 'w-1.5 bg-border',
          )}
        />
      ))}
    </div>
  )
}

// Resuming lands on 'backend' or 'stream', both of which run entirely off
// the serial + backend API - no BLE device handle needed, which is good,
// because a GATT handle never survives a reload anyway.
const initialSession = loadSessionState()

export function DeviceScanner() {
  const [step, setStep] = useState<Step>(initialSession?.step ?? 'scan')
  const [serial, setSerial] = useState(initialSession?.serial ?? '')
  const [wifiSsid, setWifiSsid] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')
  const [wifiError, setWifiError] = useState<string | null>(null)
  const [backendNotified, setBackendNotified] = useState(initialSession?.backendNotified ?? false)
  const [reminder, setReminder] = useState<string | null>(null)
  const reminderTimer = useRef<number | null>(null)
  const { device, error, scanning, scan, reset } = useBleScan()

  // Fixed-position, auto-dismissing - never affects the card's height. Only
  // relevant on scan/find/wifi: each of those only ever advances because its
  // real prerequisite (a scanned serial, a found device, a submitted WiFi
  // form) already fired, which auto-navigates away immediately. So being
  // *on* one of these steps means, by construction, that swiping forward
  // can never have a valid next screen yet - there's no "skip ahead"
  // state to reach, only a reminder that the real action still needs doing.
  const showReminder = (text: string) => {
    setReminder(text)
    if (reminderTimer.current !== null) window.clearTimeout(reminderTimer.current)
    reminderTimer.current = window.setTimeout(() => setReminder(null), 2200)
  }

  // Found -> straight to WiFi entry, no separate confirmation screen. The
  // browser's own device picker already doubles as manual confirmation.
  useEffect(() => {
    if (device && step === 'find') setStep('wifi')
  }, [device, step])

  // Once we're past Bluetooth entirely, remember where we are so closing the
  // tab/app and coming back doesn't force starting over from the QR scan -
  // reopening resumes straight into the backend status / stream screen.
  useEffect(() => {
    if (step === 'backend' || step === 'stream') {
      saveSessionState({ serial, step, backendNotified })
    }
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
    clearSessionState()
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

  const SWIPE_FORWARD_REMINDER: Partial<Record<Step, string>> = {
    scan: "Scan or enter the camera's serial to continue",
    find: 'Find the camera over Bluetooth to continue',
    wifi: 'Enter the WiFi details and continue to move on',
  }

  const swipeHandlers = useSwipe(
    () => {
      const message = SWIPE_FORWARD_REMINDER[step]
      if (message) showReminder(message)
      // pairing/backend/stream: no message, swipe forward is simply inert -
      // these are live processes, not a form to skip ahead of.
    },
    () => {
      if (step === 'find' || step === 'wifi') goBack()
      // scan has nothing before it; pairing/backend/stream intentionally
      // hide the back button too (a live BLE/network operation may be
      // in flight), so swipe-back is inert there as well.
    },
  )
  const swipeEnabled = step === 'scan' || step === 'find' || step === 'wifi'

  return (
    <div className="relative flex min-h-[560px] flex-1 flex-col gap-4">
      <div className="flex h-8 items-center justify-between">
        {step === 'scan' || step === 'pairing' || step === 'backend' || step === 'stream' ? (
          <span />
        ) : (
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back" className="-ml-2">
            <ChevronLeft />
          </Button>
        )}
        <StepDots step={step} />
      </div>

      <div
        key={step}
        className="flex flex-1 touch-pan-y flex-col animate-in"
        {...(swipeEnabled ? swipeHandlers : {})}
      >
        {step === 'scan' && (
          <ScanSerialScreen
            onSerialConfirmed={(s) => {
              setSerial(s)
              setStep('find')
            }}
          />
        )}

        {step === 'find' && (
          <FindDeviceScreen
            serial={serial}
            scanning={scanning}
            error={error}
            onScan={(mode) => scan(mode)}
          />
        )}

        {step === 'wifi' && (
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
        )}

        {step === 'pairing' && device && (
          <PairingScreen
            device={device.device}
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
          />
        )}

        {step === 'backend' && (
          <BackendHandoffScreen
            serial={serial}
            alreadyNotified={backendNotified}
            onDone={goHome}
            onRetryWifi={() => setStep('wifi')}
            onViewStream={() => setStep('stream')}
            onCancel={goHome}
          />
        )}

        {step === 'stream' && <StreamScreen serial={serial} onBack={() => setStep('backend')} />}
      </div>

      {/* Absolutely positioned and auto-dismissing - never shifts the card
          above it, however long the message runs. A plain reminder, not an
          error/warning: nothing has gone wrong, the next step just isn't
          unlocked yet. */}
      {reminder && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-4">
          <div className="animate-in rounded-full border border-border bg-card px-4 py-2 text-center text-xs font-medium text-muted-foreground shadow-lg">
            {reminder}
          </div>
        </div>
      )}
    </div>
  )
}
