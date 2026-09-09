import { Button } from '@/components/ui/button'
import { StreamTapPanel } from '@/components/StreamTapPanel'

interface StreamScreenProps {
  serial: string
  onBack: () => void
}

/**
 * Full-screen version, reached from the "View live stream" button right
 * after a fresh pairing. See StreamTapPanel.tsx / useStreamTap.ts for the
 * actual logic and why this isn't a video player. The same panel is also
 * embedded on CameraDetailScreen's "stream" tab.
 */
export function StreamScreen({ serial, onBack }: StreamScreenProps) {
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Live view
        </span>
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">
          Stream activity
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Serial <code className="font-mono font-medium text-foreground">{serial}</code>
        </p>
      </div>

      <StreamTapPanel serial={serial} />

      <Button variant="outline" onClick={onBack}>
        Back
      </Button>
    </div>
  )
}
