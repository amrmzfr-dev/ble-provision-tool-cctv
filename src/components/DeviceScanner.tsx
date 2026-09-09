import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AdminKeyGate } from '@/components/AdminKeyGate'
import { Button } from '@/components/ui/button'
import { BackendHandoffScreen } from '@/components/screens/BackendHandoffScreen'
import { FindDeviceScreen } from '@/components/screens/FindDeviceScreen'
import { PairingScreen } from '@/components/screens/PairingScreen'
import { ScanSerialScreen } from '@/components/screens/ScanSerialScreen'
import { WifiCredentialsScreen } from '@/components/screens/WifiCredentialsScreen'
import { useBleScan } from '@/hooks/useBleScan'
import { getAdminKey } from '@/lib/api/config'
import { deviceMatchesSerial } from '@/lib/ble/serial'
import { cn } from '@/lib/utils'

type Step = 'scan' | 'find' | 'wifi' | 'pairing' | 'backend'
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

export function DeviceScanner() {
  const [step, setStep] = useState<Step>('scan')
  const [serial, setSerial] = useState('')
  const [wifiSsid, setWifiSsid] = useState('')
  const [wifiPassword, setWifiPassword] = useState('')
  const [wifiError, setWifiError] = useState<string | null>(null)
  const [backendNotified, setBackendNotified] = useState(false)
  const [showKeyGate, setShowKeyGate] = useState(false)
  const { device, error, scanning, scan, reset } = useBleScan()

  // Found -> straight to WiFi entry, no separate confirmation screen. The
  // browser's own device picker already doubles as manual confirmation.
  useEffect(() => {
    if (device && step === 'find') setStep('wifi')
  }, [device, step])

  const serialMatch = device ? deviceMatchesSerial(device.name, serial) : false

  const goBack = () => {
    if (step === 'find') setStep('scan')
    if (step === 'wifi') {
      reset()
      setStep('find')
    }
  }

  return (
    <div className="flex min-h-[560px] flex-1 flex-col gap-4">
      <div className="flex h-8 items-center justify-between">
        {step === 'scan' || step === 'pairing' || step === 'backend' ? (
          <span />
        ) : (
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back" className="-ml-2">
            <ChevronLeft />
          </Button>
        )}
        <StepDots step={step} />
      </div>

      <div key={step} className="flex flex-1 flex-col animate-in">
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
            onScan={() => scan('all-devices')}
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
              // Gate pairing on having a key already saved — the whole point
              // of the onWifiSent timing fix is that the backend gets
              // notified with nothing in between it and the WiFi ack. Any
              // pause here (typing in a key mid-pairing) reopens that race.
              if (getAdminKey()) {
                setStep('pairing')
              } else {
                setShowKeyGate(true)
              }
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
            onDone={() => {
              reset()
              setSerial('')
              setWifiSsid('')
              setWifiPassword('')
              setWifiError(null)
              setBackendNotified(false)
              setStep('scan')
            }}
            onRetryWifi={() => setStep('wifi')}
          />
        )}
      </div>

      {showKeyGate && (
        <AdminKeyGate
          onContinue={() => {
            setShowKeyGate(false)
            setStep('pairing')
          }}
        />
      )}
    </div>
  )
}
