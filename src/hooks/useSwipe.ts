import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

const SWIPE_THRESHOLD_PX = 60
const MAX_VERTICAL_DRIFT_PX = 50

interface SwipeHandlers {
  onPointerDown: (e: ReactPointerEvent) => void
  onPointerMove: (e: ReactPointerEvent) => void
  onPointerUp: (e: ReactPointerEvent) => void
  onPointerCancel: () => void
}

/**
 * Minimal horizontal-swipe recognizer - no gesture library, just tracking
 * one pointer's start/end position. Ignores drags that move more vertically
 * than horizontally (that's a scroll, not a swipe) and anything under the
 * threshold (that's a tap or a wobble, not an intentional swipe).
 */
export function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void): SwipeHandlers {
  const start = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerMove = () => {
    // Position is read on release, not during drag - no live tracking or
    // drag-following animation needed for this to work.
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    start.current = null

    if (Math.abs(dy) > MAX_VERTICAL_DRIFT_PX) return
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return

    if (dx < 0) onSwipeLeft()
    else onSwipeRight()
  }

  const onPointerCancel = () => {
    start.current = null
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
