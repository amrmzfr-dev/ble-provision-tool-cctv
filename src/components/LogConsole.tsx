import { Check, Copy, ScrollText, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useDebugLog } from '@/hooks/useDebugLog'
import { clearLog, type LogLevel } from '@/lib/debugLog'
import { cn } from '@/lib/utils'

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: 'text-muted-foreground',
  tx: 'text-violet',
  rx: 'text-yellow',
  success: 'text-lime',
  error: 'text-destructive',
}

function formatLogForCopy(entries: { time: string; level: LogLevel; message: string }[]): string {
  return entries.map((e) => `[${e.time}] ${e.level.toUpperCase().padEnd(7)} ${e.message}`).join('\n')
}

export function LogConsole() {
  const entries = useDebugLog()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [entries, open])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatLogForCopy(entries))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard permission denied or unavailable — nothing more we can do here.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open debug log"
        className="fixed right-4 bottom-20 z-40 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-lg"
      >
        <ScrollText className="size-4" />
        {entries.length > 0 && (
          <span className="font-mono text-[10px] text-muted-foreground">{entries.length}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0c0c0c]/97">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <span className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.1em] text-white/70 uppercase">
              <ScrollText className="size-4" />
              Debug log
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={handleCopy}
                aria-label="Copy log"
                className="size-9 border border-white/15 bg-white/10 text-white hover:bg-white/15"
              >
                {copied ? <Check className="text-lime" /> : <Copy />}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={clearLog}
                aria-label="Clear log"
                className="size-9 border border-white/15 bg-white/10 text-white hover:bg-white/15"
              >
                <Trash2 />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close debug log"
                className="size-9 border border-white/15 bg-white/10 text-white hover:bg-white/15"
              >
                <X />
              </Button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-4">
            {entries.length === 0 ? (
              <p className="font-mono text-xs text-white/40">Nothing logged yet.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {entries.map((entry) => (
                  <p key={entry.id} className="font-mono text-[11px] leading-relaxed break-all">
                    <span className="text-white/35">{entry.time} </span>
                    <span className={cn('inline-block w-16 font-semibold', LEVEL_COLOR[entry.level])}>
                      {entry.level.toUpperCase()}
                    </span>
                    <span className="text-white/85">{entry.message}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
