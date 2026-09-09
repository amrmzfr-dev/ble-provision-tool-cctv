import { AlertTriangle, ChevronLeft, Loader2, RefreshCw, Trash2, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { adminResetDevice, getDeviceStatus } from '@/lib/api/client'
import { ApiError } from '@/lib/api/config'
import { type CameraDto, listMyCameras, removeMyCamera, updateMyCameraStatus } from '@/lib/api/myCamerasClient'
import { logEvent } from '@/lib/debugLog'
import { cn } from '@/lib/utils'

interface MyCamerasScreenProps {
  onBack: () => void
  onOpenStream: (serial: string) => void
}

type RowBusy = 'refreshing' | 'resetting' | 'confirming-reset' | 'removing' | null

function statusTone(status: string | null): string {
  if (status === 'connected') return 'bg-lime/15 text-lime border-lime/30'
  if (!status) return 'bg-muted text-muted-foreground border-border'
  if (['login_failed', 'password_error', 'serial_mismatch', 'connection_timeout'].includes(status)) {
    return 'bg-destructive/10 text-destructive border-destructive/30'
  }
  return 'bg-secondary text-secondary-foreground border-border'
}

export function MyCamerasScreen({ onBack, onOpenStream }: MyCamerasScreenProps) {
  const [cameras, setCameras] = useState<CameraDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Record<string, RowBusy>>({})

  const load = async () => {
    try {
      const list = await listMyCameras()
      setCameras(list)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your camera list.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const refreshStatus = async (serial: string) => {
    setBusy((b) => ({ ...b, [serial]: 'refreshing' }))
    try {
      logEvent('tx', `GET /device/${serial}/status (My Cameras refresh)`)
      const status = await getDeviceStatus(serial)
      logEvent('rx', `status=${status.status}`)
      await updateMyCameraStatus(serial, status.status)
      setCameras((list) =>
        (list ?? []).map((c) =>
          c.serial === serial
            ? { ...c, lastStatus: status.status, lastStatusAt: new Date().toISOString() }
            : c,
        ),
      )
    } catch (err) {
      logEvent('error', `Refresh failed for ${serial}: ${err instanceof ApiError ? err.message : String(err)}`)
    } finally {
      setBusy((b) => ({ ...b, [serial]: null }))
    }
  }

  const doReset = async (serial: string) => {
    setBusy((b) => ({ ...b, [serial]: 'resetting' }))
    try {
      logEvent('tx', `POST /admin/device/${serial}/reset (My Cameras)`)
      await adminResetDevice(serial, true)
      logEvent('success', `Factory reset sent for ${serial}`)
    } catch (err) {
      logEvent('error', `Reset failed for ${serial}: ${err instanceof ApiError ? err.message : String(err)}`)
    } finally {
      setBusy((b) => ({ ...b, [serial]: null }))
    }
  }

  const remove = async (serial: string) => {
    setBusy((b) => ({ ...b, [serial]: 'removing' }))
    try {
      await removeMyCamera(serial)
      setCameras((list) => (list ?? []).filter((c) => c.serial !== serial))
    } catch (err) {
      logEvent('error', `Remove failed for ${serial}: ${err instanceof ApiError ? err.message : String(err)}`)
      setBusy((b) => ({ ...b, [serial]: null }))
    }
  }

  return (
    <div className="flex min-h-[560px] flex-1 flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back" className="-ml-2">
          <ChevronLeft />
        </Button>
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">My cameras</h2>
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
          {cameras?.map((camera) => {
            const rowBusy = busy[camera.serial] ?? null
            return (
              <div key={camera.serial} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <code className="font-mono text-sm font-semibold">{camera.serial}</code>
                    {camera.label && <p className="text-xs text-muted-foreground">{camera.label}</p>}
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase',
                      statusTone(camera.lastStatus),
                    )}
                  >
                    {camera.lastStatus ?? 'unknown'}
                  </span>
                </div>

                {rowBusy === 'confirming-reset' ? (
                  <div className="flex flex-col gap-2 rounded-xl bg-destructive/10 p-3">
                    <span className="flex items-center gap-2 text-xs font-semibold text-destructive uppercase">
                      <AlertTriangle className="size-4" />
                      Factory reset — wipes config, irreversible
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setBusy((b) => ({ ...b, [camera.serial]: null }))}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => void doReset(camera.serial)}
                      >
                        Yes, reset it
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={rowBusy !== null}
                      onClick={() => void refreshStatus(camera.serial)}
                      aria-label="Refresh status"
                      title="Re-check this camera's live status"
                    >
                      <RefreshCw className={rowBusy === 'refreshing' ? 'animate-spin' : ''} />
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={rowBusy !== null}
                      onClick={() => onOpenStream(camera.serial)}
                    >
                      <Video />
                      Stream
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={rowBusy !== null}
                      onClick={() => setBusy((b) => ({ ...b, [camera.serial]: 'confirming-reset' }))}
                    >
                      Reset
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={rowBusy !== null}
                      onClick={() => void remove(camera.serial)}
                      aria-label="Remove from list"
                    >
                      {rowBusy === 'removing' ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
