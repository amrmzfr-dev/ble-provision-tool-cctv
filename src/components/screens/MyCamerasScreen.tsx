import { ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/config'
import { type CameraDto, listMyCameras, refreshAllMyCameras } from '@/lib/api/myCamerasClient'
import { logEvent } from '@/lib/debugLog'
import { cn } from '@/lib/utils'

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
 * Deliberately just a plain tappable list — no per-row action buttons.
 * Everything (status detail, stream, reset + its confirmation/explanation)
 * lives on CameraDetailScreen, reached by tapping a row. Refreshing status
 * for the whole list is one bulk call (refreshAllMyCameras), not one
 * request per row — see MyCamerasController.RefreshAll on the backend.
 */
export function MyCamerasScreen({ onOpenCamera }: MyCamerasScreenProps) {
  const [cameras, setCameras] = useState<CameraDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

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
          <p className="max-w-[28ch] text-xs">
            Cameras show up here automatically once a pairing finishes and comes online.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {cameras?.map((camera) => (
            <button
              key={camera.serial}
              type="button"
              onClick={() => onOpenCamera(camera.serial)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted"
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
    </div>
  )
}
