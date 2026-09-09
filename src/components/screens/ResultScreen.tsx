import { AlertTriangle, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DiscoveredDevice } from '@/lib/ble/types'

interface ResultScreenProps {
  device: DiscoveredDevice
  serialMatch: boolean
  onScanAgain: () => void
  onContinue: () => void
}

export function ResultScreen({ device, serialMatch, onScanAgain, onContinue }: ResultScreenProps) {
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Step 3 of 6
        </span>
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">
          Device found
        </h2>
      </div>

      <div
        className={cn(
          'flex flex-1 flex-col gap-4 rounded-2xl p-5',
          serialMatch
            ? 'glow-lime bg-lime text-[#0c0c0c]'
            : 'glow-destructive bg-destructive text-white dark:text-[#0c0c0c]',
        )}
      >
        <div className="flex items-center gap-3">
          {serialMatch ? (
            <CheckCircle2 className="size-10 shrink-0" strokeWidth={1.5} />
          ) : (
            <AlertTriangle className="size-10 shrink-0" strokeWidth={1.5} />
          )}
          <Badge variant="outline" className="w-fit border-current/30 text-current">
            {serialMatch ? 'serial matches' : "serial doesn't match"}
          </Badge>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span>
            <span className="opacity-70">Advertised name: </span>
            <code className="font-mono font-medium">{device.name}</code>
          </span>
          <span className="break-all">
            <span className="opacity-70">Browser device id: </span>
            <code className="font-mono text-xs font-medium">{device.id}</code>
          </span>
        </div>

        {!serialMatch && (
          <p className="text-xs font-medium">
            This device's advertised name doesn't contain the serial you scanned. Wrong camera
            nearby, or the QR was misread — check both before continuing.
          </p>
        )}

        <p className="text-xs opacity-70">
          Also note the characters before the serial in the advertised name — that's the
          4-character prefix this app still needs confirmed for the next phase.
        </p>

        <div className="flex-1" />

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onScanAgain}
            className="border-current/30 bg-transparent"
          >
            <RotateCcw />
            Scan again
          </Button>
          <Button
            onClick={onContinue}
            className="flex-1 bg-[#0c0c0c] text-white hover:bg-[#0c0c0c]/85"
          >
            Continue
            <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
