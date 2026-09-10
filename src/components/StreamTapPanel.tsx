import { AlertTriangle, Loader2, Play, Radio, RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStreamTap } from '@/hooks/useStreamTap'
import { cn } from '@/lib/utils'

interface StreamTapPanelProps {
  serial: string
  /** Fixed height for the content box - same box for every phase, see the note below. */
  heightClassName?: string
  /** False shows an idle "ready to test" state with a Start button instead of connecting immediately on mount. */
  autoStart?: boolean
  /** Whether the camera is actually connected right now, per whatever already checked it (e.g. CameraDetailScreen's own status badge) - only ever consulted in the idle phase, so autoStart callers (which never reach idle) can skip it. The badge says "Ready" only when this is true, "Can't stream" otherwise (unknown/loading counts as not-ready, not a guess). */
  isConnected?: boolean
}

/**
 * The stream-activity UI (status strip, log/status content, Stop/Start) -
 * used both by the full-screen StreamScreen and embedded inline on a
 * camera's detail page. See useStreamTap.ts for why this isn't a video
 * player.
 *
 * The outer shape (status strip height, content box height, button row
 * height) is IDENTICAL across every phase - idle/waiting/connecting, live,
 * stopped, and error. Every phase used to render a different-sized block
 * (an error banner, a centered spinner card, or the log box, each with
 * their own height, plus the button row only existing at all once stats
 * existed) so the whole card visibly resized as the stream moved through
 * its lifecycle. Now there is exactly one status strip, one content box,
 * and one button row, always - only what's drawn *inside* each of those
 * three fixed slots changes.
 */
export function StreamTapPanel({
  serial,
  heightClassName = 'h-72',
  autoStart = true,
  isConnected = true,
}: StreamTapPanelProps) {
  const { phase, error, stats, lines, logBoxRef, isLive, stop, restart, activate } = useStreamTap(serial, {
    autoStart,
  })

  const statusLabel =
    phase === 'idle'
      ? isConnected
        ? 'Ready'
        : "Can't stream"
      : phase === 'error'
        ? 'Error'
        : phase === 'stopped'
          ? 'Stopped'
          : isLive
            ? 'Live'
            : 'Connecting…'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-9 shrink-0 items-center justify-between rounded-xl border border-border bg-card px-3">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase">
          <Radio className={isLive ? 'size-3.5 animate-gc-pulse text-primary' : 'size-3.5 text-muted-foreground'} />
          {statusLabel}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {stats ? `${stats.chunks} chunks · ${(stats.bytes / 1024).toFixed(1)} KB` : 'not started yet'}
        </span>
      </div>

      <div
        className={cn(
          heightClassName,
          'shrink-0 overflow-y-auto rounded-2xl border border-border bg-[#0c0c0c] p-3 font-mono text-[11px] leading-relaxed text-lime',
        )}
      >
        {phase === 'idle' ? (
          // Not a real status claim (this doesn't check whether the camera
          // is actually connected - that's what the badge in the header is
          // for) - just a static mock-up of what the real log looks like,
          // clearly labeled as an example so it can't be mistaken for one.
          <div className="flex h-full flex-col gap-2">
            <p className="text-[10px] tracking-wide text-white/40 uppercase">Example of a streaming log</p>
            <div className="flex flex-col gap-0.5 opacity-60">
              <p>01:43:12.045  connected, reading live stream body</p>
              <p>01:43:12.098  chunk 1  +7.3 KB  (total 7.3 KB)</p>
              <p>01:43:12.140  chunk 2  +6.9 KB  (total 14.2 KB)</p>
              <p>01:43:12.183  chunk 3  +7.1 KB  (total 21.3 KB)</p>
            </div>
          </div>
        ) : phase === 'error' ? (
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
        No video stream will be shown here - the logs above act as proof it's actually streaming.
      </p>

      {/* One button, not two/three side by side with the rest invisible - it
          just changes what it does depending on phase. Only one of
          Start/Stop/Retry is ever applicable at a time. */}
      <div className="shrink-0">
        {phase === 'idle' ? (
          <Button variant="outline" className="w-full" onClick={activate}>
            <Play />
            Start
          </Button>
        ) : isLive ? (
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
