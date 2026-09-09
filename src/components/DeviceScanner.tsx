import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BackendHandoffScreen } from '@/components/screens/BackendHandoffScreen'
import { FindDeviceScreen } from '@/components/screens/FindDeviceScreen'
import { PairingScreen } from '@/components/screens/PairingScreen'
import { ResultScreen } from '@/components/screens/ResultScreen'
import { ScanSerialScreen } from '@/components/screens/ScanSerialScreen'
import { WifiCredentialsScreen } from '@/components/screens/WifiCredentialsScreen'
import { useBleScan } from '@/hooks/useBleScan'
import { deviceMatchesSerial } from '@/lib/ble/serial'
import { cn } from '@/lib/utils'

type Step = 'scan' | 'find' | 'confirm' | 'wifi' | 'pairing' | 'backend'
const STEPS: Step[] = ['scan', 'find', 'confirm', 'wifi', 'pairing', 'backend']

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
  const { device, error, scanning, scan, reset } = useBleScan()

  useEffect(() => {
    if (device && step === 'find') setStep('confirm')
  }, [device, step])

  const serialMatch = device ? deviceMatchesSerial(device.name, serial) : false

  const goBack = () => {
    if (step === 'find') setStep('scan')
    if (step === 'confirm') {
      reset()
      setStep('find')
    }
    if (step === 'wifi') setStep('confirm')
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
          <FindDeviceScreen serial={serial} scanning={scanning} error={error} onScan={scan} />
        )}

        {step === 'confirm' && device && (
          <ResultScreen
            device={device}
            serialMatch={serialMatch}
            onScanAgain={() => {
              reset()
              setStep('find')
            }}
            onContinue={() => setStep('wifi')}
          />
        )}

        {step === 'wifi' && (
          <WifiCredentialsScreen
            deviceName={device?.name ?? serial}
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
            ssid={wifiSsid}
            password={wifiPassword}
            onBack={() => setStep('wifi')}
            onSuccess={(result) => {
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
            onDone={() => {
              reset()
              setSerial('')
              setWifiSsid('')
              setWifiPassword('')
              setWifiError(null)
              setStep('scan')
            }}
            onRetryWifi={() => setStep('wifi')}
          />
        )}
      </div>
    </div>
  )
}
