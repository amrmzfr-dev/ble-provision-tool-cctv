import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  PROVISION_STAGE_LABEL,
  runProvisioning,
  type ProvisionResult,
  type ProvisionStage,
} from '@/lib/ble/provision'

const STAGE_ORDER: ProvisionStage[] = [
  'connecting',
  'exchanging-key',
  'reading-serial',
  'reading-security-code',
  'syncing-time',
  'sending-wifi',
  'waiting-for-join',
]

interface PairingScreenProps {
  device: BluetoothDevice
  ssid: string
  password: string
  onSuccess: (result: ProvisionResult) => void
  onBack: () => void
}

export function PairingScreen({ device, ssid, password, onSuccess, onBack }: PairingScreenProps) {
  const [stage, setStage] = useState<ProvisionStage>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setStage('connecting')

    runProvisioning(device, ssid, password, (s) => {
      if (!cancelled) setStage(s)
    })
      .then((result) => {
        if (!cancelled) onSuccess(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  const currentIndex = STAGE_ORDER.indexOf(stage)

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Step 4 of 5
        </span>
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">Pairing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep this tab open and the camera nearby — this only takes a few seconds.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-2 rounded-2xl border border-border bg-card p-5">
        {STAGE_ORDER.map((s, i) => {
          const done = !error && i < currentIndex
          const active = !error && i === currentIndex
          const failed = error !== null && i === currentIndex
          return (
            <div key={s} className="flex items-center gap-3 py-1.5">
              <span className="flex size-6 shrink-0 items-center justify-center">
                {done ? (
                  <CheckCircle2 className="size-5 text-lime" />
                ) : active ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : failed ? (
                  <span className="size-2 rounded-full bg-destructive" />
                ) : (
                  <span className="size-1.5 rounded-full bg-border" />
                )}
              </span>
              <span
                className={
                  done || active || failed
                    ? 'text-sm font-medium text-foreground'
                    : 'text-sm text-muted-foreground'
                }
              >
                {PROVISION_STAGE_LABEL[s]}
              </span>
            </div>
          )
        })}

        <div className="flex-1" />

        {error && (
          <>
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onBack}>
                Back to WiFi
              </Button>
              <Button className="flex-1" onClick={() => setAttempt((a) => a + 1)}>
                <RotateCcw />
                Retry
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
