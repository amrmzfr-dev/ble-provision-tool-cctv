import { HelpCircle, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

interface HelpTipProps {
  title: string
  imageSrc?: string
  imageAlt?: string
  children: ReactNode
}

/**
 * A small "?" button that opens a full guide as a modal — for exactly the
 * kind of thing a first-time user won't know to ask about (which QR code,
 * what the camera's LED means) but an experienced tester wouldn't need
 * explained every time, so it stays out of the way until tapped.
 *
 * The modal itself is a fixed height, always vertically centered, with only
 * the middle content area scrolling — a short guide and a long one (e.g.
 * two images stacked) both render at the same size instead of the modal
 * growing to fit whatever's inside it, the same fixed-container rule
 * StreamTapPanel already follows.
 */
export function HelpTip({ title, imageSrc, imageAlt, children }: HelpTipProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Help: ${title}`}
        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
      >
        <HelpCircle className="size-3.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-in flex h-[70svh] w-full max-w-md flex-col gap-3 rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between">
              <span className="text-sm font-black uppercase tracking-tight">{title}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {imageSrc && (
                <img src={imageSrc} alt={imageAlt ?? ''} className="mb-3 w-full rounded-xl border border-border" />
              )}
              <div className="text-justify text-sm text-muted-foreground">{children}</div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
