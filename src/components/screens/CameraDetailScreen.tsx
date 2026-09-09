import { AlertTriangle, ChevronLeft, Loader2, RefreshCw, Trash2, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StreamTapPanel } from '@/components/StreamTapPanel'
import { Button } from '@/components/ui/button'
import { adminResetDevice, getDeviceStatus } from '@/lib/api/client'
import { ApiError } from '@/lib/api/config'
import { removeMyCamera, updateMyCameraStatus } from '@/lib/api/myCamerasClient'
import { logEvent } from '@/lib/debugLog'
import { cn } from '@/lib/utils'

interface CameraDetailScreenProps {
  serial: string
  onBack: () => void
  onRemoved: () => void
}

type Tab = 'status' | 'stream' | 'reset'

function statusTone(status: string | null): string {
  if (status === 'connected') return 'bg-lime/15 text-lime border-lime/30'
  if (!status) return 'bg-muted text-muted-foreground border-border'
  if (['login_failed', 'password_error', 'serial_mismatch', 'connection_timeout'].includes(status)) {
    return 'bg-destructive/10 text-destructive border-destructive/30'
  }
  return 'bg-secondary text-secondary-foreground border-border'
}

/**
 * Everything about one camera in one place — reached by tapping a row in
 * MyCamerasScreen. Replaces what used to be four buttons crammed into a
 * list card: status (with its own live re-check), the embedded stream tap
 * (StreamTapPanel — polling only runs while this screen is actually open,
 * so it doesn't add background load), and reset with a real confirmation
 * step and an explanation of when it does and doesn't work.
 */
export function CameraDetailScreen({ serial, onBack, onRemoved }: CameraDetailScreenProps) {
  const [tab, setTab] = useState<Tab>('status')
  const [status, setStatus] = useState<string | null>(null)
  const [statusCheckedAt, setStatusCheckedAt] = useState<Date | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [resetState, setResetState] = useState<'idle' | 'confirming' | 'resetting' | 'done' | 'error'>('idle')
  const [resetError, setResetError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const checkStatus = async () => {
    setStatusLoading(true)
    setStatusError(null)
    try {
      logEvent('tx', `GET /device/${serial}/status`)
      const result = await getDeviceStatus(serial)
      logEvent('rx', `status=${result.status}`)
      setStatus(result.status)
      setStatusCheckedAt(new Date())
      await updateMyCameraStatus(serial, result.status).catch(() => {
        // Cache write failing isn't worth surfacing — the live check above already succeeded.
      })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err)
      logEvent('error', `Status check failed: ${message}`)
      setStatusError(message)
    } finally {
      setStatusLoading(false)
    }
  }

  useEffect(() => {
    void checkStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial])

  const handleReset = async () => {
    setResetState('resetting')
    setResetError(null)
    logEvent('tx', `POST /admin/device/${serial}/reset (factory_reset=true)`)
    try {
      await adminResetDevice(serial, true)
      logEvent('success', `Factory reset command sent for ${serial}`)
      setResetState('done')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err)
      logEvent('error', `Reset failed: ${message}`)
      setResetError(message)
      setResetState('error')
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await removeMyCamera(serial)
      onRemoved()
    } catch (err) {
      logEvent('error', `Remove failed: ${err instanceof ApiError ? err.message : String(err)}`)
      setRemoving(false)
    }
  }

  return (
    <div className="flex min-h-[560px] flex-1 flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back" className="-ml-2">
          <ChevronLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <code className="block truncate font-mono text-lg font-black">{serial}</code>
        </div>
        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase', statusTone(status))}>
          {statusLoading ? '…' : (status ?? 'unknown')}
        </span>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {(['status', 'stream', 'reset'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-lg py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
              tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'status' && (
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Live status</span>
              <Button variant="outline" size="sm" onClick={() => void checkStatus()} disabled={statusLoading}>
                <RefreshCw className={statusLoading ? 'animate-spin' : ''} />
                Refresh
              </Button>
            </div>
            <span className={cn('inline-block w-fit rounded-full border px-3 py-1 font-mono text-xs uppercase', statusTone(status))}>
              {statusLoading ? 'checking…' : (status ?? 'unknown')}
            </span>
            {statusCheckedAt && (
              <p className="text-xs text-muted-foreground">Checked at {statusCheckedAt.toLocaleTimeString()}</p>
            )}
            {statusError && <p className="text-xs text-destructive">{statusError}</p>}
          </div>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => void handleRemove()}
            disabled={removing}
            className="flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium text-muted-foreground hover:text-destructive"
          >
            {removing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Remove from this list
          </button>
        </div>
      )}

      {tab === 'stream' && (
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Video className="size-3.5" />
            Polling and the stream tap only run while this tab is open.
          </div>
          <StreamTapPanel serial={serial} logHeightClassName="min-h-64 flex-1" />
        </div>
      )}

      {tab === 'reset' && (
        <div className="flex flex-1 flex-col gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <p>
              Factory reset wipes the camera's WiFi and login config and puts it back into
              Bluetooth pairing mode — used to take a unit from "just tested" to "clean for
              redeployment" without needing physical access.
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Only works while the camera is actively connected.</strong>{' '}
              The reset command routes through the backend's live session for this device, not a
              fresh connection made on demand. If it's already disconnected, this will fail —
              a physical reset on the unit itself is the only option at that point.
            </p>
          </div>

          {resetState === 'done' ? (
            <p className="rounded-xl bg-lime/10 p-3 text-sm text-lime">
              Factory reset sent — the camera should reboot into pairing mode shortly.
            </p>
          ) : resetState === 'confirming' ? (
            <div className="flex flex-col gap-2 rounded-xl bg-destructive/10 p-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-destructive uppercase">
                <AlertTriangle className="size-4" />
                This wipes all config — irreversible
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setResetState('idle')}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" className="flex-1" onClick={() => void handleReset()}>
                  Yes, reset it
                </Button>
              </div>
            </div>
          ) : resetState === 'resetting' ? (
            <div className="flex items-center gap-2 rounded-xl bg-muted p-3 text-xs font-medium">
              <Loader2 className="size-4 animate-spin" />
              Sending reset command…
            </div>
          ) : (
            <>
              {resetState === 'error' && (
                <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                  Reset failed: {resetError}
                </p>
              )}
              <Button variant="destructive" onClick={() => setResetState('confirming')}>
                <Trash2 />
                Reset for redeployment
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
