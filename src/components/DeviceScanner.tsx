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
import { clearSessionState, loadSessionState, saveSessionState } from '@/lib/sessionState'
import { cn } from '@/lib/utils'

type Step = 'scan' | 'find' | 'wifi' | 'pairing' | 'backend' | 'stream'
const STEPS: Step[] = ['scan', 'find', 'wifi', 'pairing', 'backend']

// Short copy for the preview cards shown while swiping ahead of (or back
// through) real progress - the same idea each screen's own header already
// carries, just standalone here since a not-yet-reached step (e.g.
// 'pairing' with no device found yet) can't safely mount its real
// functional component at all.
const STEP_INFO: Record<Exclude<Step, 'stream'>, { title: string; description: string }> = {
  scan: {
    title: "Scan the camera's serial",
    description: 'Find the QR sticker on the camera, then scan it or type it in.',
  },
  find: {
    title: 'Find it over Bluetooth',
    description: "Your browser's own device picker, pre-filtered to just this camera's kind of device.",
  },
  wifi: {
    title: 'WiFi for the camera',
    description: "Enter the WiFi network's name and password so the camera can join it.",
  },
  pairing: {
    title: 'Pairing',
    description: 'Sends the WiFi details to the camera over Bluetooth and waits for it to acknowledge them.',
  },
  backend: {
    title: 'Connecting to the server',
    description: "Tells the backend WiFi is set, then waits for the camera to actually come online.",
  },
}

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
  const { device, error, scanning, scan, reset } = useBleScan()

  const realIndex = STEPS.indexOf(step)
  // Which step's content is actually being shown - independent of `step`
  // (real progress) so a swipe can browse ahead to preview a step that
  // hasn't been reached yet, or back to review one already passed, without
  // touching any real BLE/network state. Only when this matches the real
  // step does the actual functional screen mount; otherwise a lightweight,
  // read-only preview card renders instead - swiping ahead of a live BLE
  // handshake can't run it early, but showing what it is and why it isn't
  // unlocked yet is exactly what was asked for.
  const [previewIndex, setPreviewIndex] = useState(realIndex)

  // Real progress always wins - the moment something actually happens
  // (a serial gets confirmed, a device is found, ...), snap the view back
  // to it rather than leaving the user stranded on a stale preview.
  useEffect(() => {
    setPreviewIndex(STEPS.indexOf(step))
  }, [step])

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

  // Pure view navigation - never mutates real step/device/BLE state, so
  // swiping through the whole flow to see what's coming is always safe,
  // completed or not.
  const swipeHandlers = useSwipe(
    () => setPreviewIndex((i) => Math.min(i + 1, STEPS.length - 1)),
    () => setPreviewIndex((i) => Math.max(i - 1, 0)),
  )

  const previewedStep = STEPS[previewIndex]
  const isViewingRealStep = previewIndex === realIndex
  // Only meaningful ahead of real progress - reviewing an already-completed
  // step needs no such reminder, there's nothing left to finish there.
  const previewIncomplete = !isViewingRealStep && previewIndex > realIndex

  return (
    <div className="relative flex min-h-[560px] flex-1 flex-col gap-4">
      <div className="flex h-8 items-center justify-between">
        {isViewingRealStep && (step === 'find' || step === 'wifi') ? (
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back" className="-ml-2">
            <ChevronLeft />
          </Button>
        ) : previewIndex > 0 ? (
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
        {!isViewingRealStep ? (
          <div className="flex flex-1 flex-col gap-5">
            <div>
              <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Step {previewIndex + 1} of {STEPS.length}
              </span>
              <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">
                {STEP_INFO[previewedStep as Exclude<Step, 'stream'>].title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {STEP_INFO[previewedStep as Exclude<Step, 'stream'>].description}
              </p>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              <p>Just previewing what's ahead.</p>
              <p className="text-xs">Swipe to keep browsing, or complete the steps in order to actually get here.</p>
            </div>
          </div>
        ) : step === 'scan' ? (
          <ScanSerialScreen
            onSerialConfirmed={(s) => {
              setSerial(s)
              setStep('find')
            }}
          />
        ) : step === 'find' ? (
          <FindDeviceScreen serial={serial} scanning={scanning} error={error} onScan={(mode) => scan(mode)} />
        ) : step === 'wifi' ? (
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
        ) : step === 'pairing' && device ? (
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
        ) : step === 'backend' ? (
          <BackendHandoffScreen
            serial={serial}
            alreadyNotified={backendNotified}
            onDone={goHome}
            onRetryWifi={() => setStep('wifi')}
            onViewStream={() => setStep('stream')}
            onCancel={goHome}
          />
        ) : step === 'stream' ? (
          <StreamScreen serial={serial} onBack={() => setStep('backend')} />
        ) : null}
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
