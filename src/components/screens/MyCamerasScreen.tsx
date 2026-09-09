import { AlertTriangle, ChevronRight, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/config'
import { type CameraDto, listMyCameras, refreshAllMyCameras, removeMyCamera } from '@/lib/api/myCamerasClient'
import { logEvent } from '@/lib/debugLog'
import { cn } from '@/lib/utils'

const LONG_PRESS_MS = 2000

interface MyCamerasScreenProps {
  onOpenCamera: (serial: string) => void
}

function statusTone(status: string | null): string {
  if (status === 'connected') return 'bg-lime/15 text-lime border-lime/30'
  if (!status) return 'bg-muted text-muted-foreground border-border'
  if (['login_failed', 'password_error', 'serial_mismatch', 'connection_timeout'].includes(status)) {
    return 'bg-destructive/10 text-destructive border-destructive/30'
  }
  return 'bg-secondary text-secondary-foreground border-border'
}

/**
 * A plain tappable list - no per-row action buttons cluttering each card.
 * Tap opens CameraDetailScreen (status/stream/reset all live there). Hold a
 * row for ~2s to bring up a "delete from list?" confirmation instead -
 * removing a camera from this personal list isn't something that should be
 * one accidental tap away, but it's also not important enough to earn a
 * permanent button on every row.
 */
export function MyCamerasScreen({ onOpenCamera }: MyCamerasScreenProps) {
  const [cameras, setCameras] = useState<CameraDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [confirmDeleteSerial, setConfirmDeleteSerial] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)

  useEffect(() => {
    listMyCameras()
      .then(setCameras)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load your camera list.'))
  }, [])

  const refreshAll = async () => {
    setRefreshing(true)
    try {
      logEvent('tx', 'POST /mycameras/refresh (bulk status check)')
      const updated = await refreshAllMyCameras()
      logEvent('success', `Refreshed ${updated.length} camera(s)`)
      setCameras(updated)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err)
      logEvent('error', `Bulk refresh failed: ${message}`)
      setError(message)
    } finally {
      setRefreshing(false)
    }
  }

  const startPress = (serial: string) => {
    longPressFired.current = false
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true
      setConfirmDeleteSerial(serial)
    }, LONG_PRESS_MS)
  }

  const cancelPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handleRowClick = (serial: string) => {
    // The long-press timer already opened the delete confirmation - this
    // click is just the same touch/click being released, not a new tap.
    if (longPressFired.current) return
    onOpenCamera(serial)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteSerial) return
    setDeleting(true)
    try {
      await removeMyCamera(confirmDeleteSerial)
      setCameras((list) => (list ?? []).filter((c) => c.serial !== confirmDeleteSerial))
      setConfirmDeleteSerial(null)
    } catch (err) {
      logEvent('error', `Remove failed: ${err instanceof ApiError ? err.message : String(err)}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-[560px] flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">My cameras</h2>
        {cameras && cameras.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => void refreshAll()} disabled={refreshing}>
            <RefreshCw className={refreshing ? 'animate-spin' : ''} />
            Refresh all
          </Button>
        )}
      </div>

      {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {cameras === null && !error ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : cameras && cameras.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <p>No cameras yet.</p>
          <p className="text-xs">
            Cameras show up here automatically once a pairing finishes and comes online.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {cameras?.map((camera) => (
            <button
              key={camera.serial}
              type="button"
              onPointerDown={() => startPress(camera.serial)}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onClick={() => handleRowClick(camera.serial)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors select-none hover:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <code className="block truncate font-mono text-sm font-semibold">{camera.serial}</code>
                {camera.label && <p className="truncate text-xs text-muted-foreground">{camera.label}</p>}
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase',
                  statusTone(camera.lastStatus),
                )}
              >
                {camera.lastStatus ?? 'unknown'}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {confirmDeleteSerial && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setConfirmDeleteSerial(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-sm font-semibold uppercase">
              <AlertTriangle className="size-4 text-destructive" />
              Delete from list?
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              <code className="text-foreground">{confirmDeleteSerial}</code> will be removed from
              this list. This doesn't reset or disconnect the camera itself.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteSerial(null)}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" disabled={deleting} onClick={() => void confirmDelete()}>
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
