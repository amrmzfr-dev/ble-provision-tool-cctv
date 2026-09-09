import { AlertTriangle, Loader2, Play, Radio, RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStreamTap } from '@/hooks/useStreamTap'
import { cn } from '@/lib/utils'

interface StreamTapPanelProps {
  serial: string
  /** Fixed height for the content box - same box for every phase, see the note below. */
  heightClassName?: string
}

/**
 * The stream-activity UI (status strip, log/status content, Stop/Start) -
 * used both by the full-screen StreamScreen and embedded inline on a
 * camera's detail page. See useStreamTap.ts for why this isn't a video
 * player.
 *
 * The outer shape (status strip height, content box height, button row
 * height) is IDENTICAL across every phase - default/waiting/connecting,
 * live, stopped, and error. Every phase used to render a different-sized
 * block (an error banner, a centered spinner card, or the log box, each
 * with their own height, plus the button row only existing at all once
 * stats existed) so the whole card visibly resized as the stream moved
 * through its lifecycle. Now there is exactly one status strip, one content
 * box, and one button row, always - only what's drawn *inside* each of
 * those three fixed slots changes.
 */
export function StreamTapPanel({ serial, heightClassName = 'h-72' }: StreamTapPanelProps) {
  const { phase, error, stats, lines, logBoxRef, isLive, stop, restart } = useStreamTap(serial)

  const statusLabel =
    phase === 'error' ? 'Error' : phase === 'stopped' ? 'Stopped' : isLive ? 'Live' : 'Connecting…'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-9 shrink-0 items-center justify-between rounded-xl border border-border bg-card px-3">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase">
          <Radio className={isLive ? 'size-3.5 animate-gc-pulse text-primary' : 'size-3.5 text-muted-foreground'} />
          {statusLabel}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {stats ? `${stats.chunks} chunks · ${(stats.bytes / 1024).toFixed(1)} KB` : '- chunks · - KB'}
        </span>
      </div>

      <div
        className={cn(
          heightClassName,
          'shrink-0 overflow-y-auto rounded-2xl border border-border bg-[#0c0c0c] p-3 font-mono text-[11px] leading-relaxed text-lime',
        )}
      >
        {phase === 'error' ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <AlertTriangle className="size-6 text-destructive" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-destructive">Couldn't confirm the stream</p>
            <p className="text-justify font-mono text-xs text-white/50">{error}</p>
          </div>
        ) : !stats ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-semibold text-white/85">
              {phase === 'waiting-online' ? 'Waiting for the camera to be online…' : 'Opening the stream…'}
            </p>
            <p className="text-justify font-mono text-xs text-white/50">
              Checking <code className="font-mono">/admin/device/{serial}</code> fresh, same as the
              reference Android app does right before it opens a stream.
            </p>
          </div>
        ) : (
          <div ref={logBoxRef} className="h-full overflow-y-auto">
            {lines.length === 0 ? (
              <p className="text-white/30">Waiting for the first chunk…</p>
            ) : (
              lines.map((line, i) => <p key={i}>{line}</p>)
            )}
          </div>
        )}
      </div>

      <p className="shrink-0 text-justify font-mono text-xs text-muted-foreground">
        This app can't play the video itself. But if logs are coming in below, the camera really
        is streaming live.
      </p>

      {/* One button, not two side by side with one always invisible - it
          just changes what it does depending on phase. Only Stop and
          Start/Retry are ever mutually applicable, so there's never a case
          where two actions are needed at once. */}
      <div className="shrink-0">
        {isLive ? (
          <Button variant="outline" className="w-full" onClick={stop}>
            <Square />
            Stop
          </Button>
        ) : phase === 'stopped' || phase === 'error' ? (
          <Button variant="outline" className="w-full" onClick={restart}>
            {phase === 'error' ? <RotateCcw /> : <Play />}
            {phase === 'error' ? 'Retry' : 'Start'}
          </Button>
        ) : (
          <Button variant="outline" className="invisible w-full" tabIndex={-1} aria-hidden>
            <Play />
            Start
          </Button>
        )}
      </div>
    </div>
  )
}
