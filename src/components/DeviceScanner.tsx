import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FindDeviceScreen } from '@/components/screens/FindDeviceScreen'
import { ResultScreen } from '@/components/screens/ResultScreen'
import { ScanSerialScreen } from '@/components/screens/ScanSerialScreen'
import { useBleScan } from '@/hooks/useBleScan'
import { deviceMatchesSerial } from '@/lib/ble/serial'
import { cn } from '@/lib/utils'

type Step = 'scan' | 'find' | 'result'
const STEPS: Step[] = ['scan', 'find', 'result']

function StepDots({ step }: { step: Step }) {
  const index = STEPS.indexOf(step)
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i === index ? 'w-5 bg-primary' : 'w-1.5 bg-border',
          )}
        />
      ))}
    </div>
  )
}

export function DeviceScanner() {
  const [step, setStep] = useState<Step>('scan')
  const [serial, setSerial] = useState('')
  const { device, error, scanning, scan, reset } = useBleScan()

  useEffect(() => {
    if (device) setStep('result')
  }, [device])

  const serialMatch = device ? deviceMatchesSerial(device.name, serial) : false

  const goBack = () => {
    if (step === 'find') setStep('scan')
    if (step === 'result') {
      reset()
      setStep('find')
    }
  }

  return (
    <div className="flex min-h-[560px] flex-1 flex-col gap-4">
      <div className="flex h-8 items-center justify-between">
        {step === 'scan' ? (
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
        {step === 'result' && device && (
          <ResultScreen device={device} serialMatch={serialMatch} onScanAgain={goBack} />
        )}
      </div>
    </div>
  )
}
