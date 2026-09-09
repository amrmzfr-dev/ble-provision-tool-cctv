import { AlertTriangle, Loader2, Play, Radio, RotateCcw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStreamTap } from '@/hooks/useStreamTap'

interface StreamTapPanelProps {
  serial: string
  /** Fixed height for the log area — StreamScreen (full page) wants it to fill available space; CameraDetailScreen (one section among several) wants a bounded height instead. */
  logHeightClassName?: string
}

/**
 * The stream-activity UI (status badge, live log, Stop/Start) without any
 * page chrome — used both by the full-screen StreamScreen and embedded
 * inline on a camera's detail page. See useStreamTap.ts for why this isn't
 * a video player.
 */
export function StreamTapPanel({ serial, logHeightClassName = 'flex-1' }: StreamTapPanelProps) {
  const { phase, error, stats, lines, logBoxRef, isLive, stop, restart } = useStreamTap(serial)

  return (
    <div className="flex flex-1 flex-col gap-3">
      {phase === 'error' && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-center">
          <AlertTriangle className="size-6 text-destructive" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-destructive">Couldn't confirm the stream</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      )}

      {!stats && phase !== 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-5 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-semibold">
            {phase === 'waiting-online' ? 'Waiting for the camera to be online…' : 'Opening the stream…'}
          </p>
          <p className="text-xs text-muted-foreground">
            Checking <code className="font-mono">/admin/device/{serial}</code> fresh, same as the
            reference Android app does right before it opens a stream.
          </p>
        </div>
      )}

      {stats && (
        <>
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase">
              <Radio className={isLive ? 'size-3.5 animate-gc-pulse text-primary' : 'size-3.5 text-muted-foreground'} />
              {isLive ? 'Live' : 'Stopped'}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {stats.chunks} chunks · {(stats.bytes / 1024).toFixed(1)} KB
            </span>
          </div>

          <div
            ref={logBoxRef}
            className={`${logHeightClassName} overflow-y-auto rounded-2xl border border-border bg-[#0c0c0c] p-3 font-mono text-[11px] leading-relaxed text-lime`}
          >
            {lines.length === 0 ? (
              <p className="text-white/30">Waiting for the first chunk…</p>
            ) : (
              lines.map((line, i) => <p key={i}>{line}</p>)
            )}
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        No video preview: this camera streams H.265, which browsers can't decode. This confirms
        the full path — browser → backend → the camera's live session — is actually working.
      </p>

      {(isLive || phase === 'stopped' || phase === 'error') && (
        <div className="flex gap-2">
          {isLive && (
            <Button variant="outline" className="flex-1" onClick={stop}>
              <Square />
              Stop
            </Button>
          )}
          {(phase === 'stopped' || phase === 'error') && (
            <Button variant="outline" className="flex-1" onClick={restart}>
              {phase === 'error' ? <RotateCcw /> : <Play />}
              {phase === 'error' ? 'Retry' : 'Start'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
