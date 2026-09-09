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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-in flex max-h-[85svh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
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

            {imageSrc && (
              <img src={imageSrc} alt={imageAlt ?? ''} className="w-full rounded-xl border border-border" />
            )}

            <div className="text-justify text-sm text-muted-foreground">{children}</div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
