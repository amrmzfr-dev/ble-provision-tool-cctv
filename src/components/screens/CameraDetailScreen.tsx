import { AlertTriangle, ChevronLeft, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StreamTapPanel } from '@/components/StreamTapPanel'
import { Button } from '@/components/ui/button'
import { adminResetDevice, getDeviceStatus } from '@/lib/api/client'
import { ApiError } from '@/lib/api/config'
import { updateMyCameraStatus } from '@/lib/api/myCamerasClient'
import { logEvent } from '@/lib/debugLog'
import { cn } from '@/lib/utils'

interface CameraDetailScreenProps {
  serial: string
  onBack: () => void
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
 * One page, no tabs - stream log up top (roughly 70% of the space, with a
 * genuinely FIXED height so it scrolls internally instead of growing the
 * whole page as lines accumulate; a live stream easily produces thousands
 * of lines), reset below (~30%), status folded into a small badge in the
 * header instead of taking its own section.
 */
export function CameraDetailScreen({ serial, onBack }: CameraDetailScreenProps) {
  const [status, setStatus] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const [resetState, setResetState] = useState<'idle' | 'confirming' | 'resetting' | 'done' | 'error'>('idle')
  const [resetError, setResetError] = useState<string | null>(null)

  const checkStatus = async () => {
    setStatusLoading(true)
    try {
      logEvent('tx', `GET /device/${serial}/status`)
      const result = await getDeviceStatus(serial)
      logEvent('rx', `status=${result.status}`)
      setStatus(result.status)
      await updateMyCameraStatus(serial, result.status).catch(() => {
        // Cache write failing isn't worth surfacing - the live check above already succeeded.
      })
    } catch (err) {
      logEvent('error', `Status check failed: ${err instanceof ApiError ? err.message : String(err)}`)
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

  return (
    <div className="flex min-h-[560px] flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back" className="-ml-2">
          <ChevronLeft />
        </Button>
        <code className="min-w-0 flex-1 truncate font-mono text-lg font-black">{serial}</code>
        <button
          type="button"
          onClick={() => void checkStatus()}
          disabled={statusLoading}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase',
            statusTone(status),
          )}
        >
          <RefreshCw className={cn('size-3', statusLoading && 'animate-spin')} />
          {statusLoading ? 'checking' : (status ?? 'unknown')}
        </button>
      </div>

      {/* ~70% of the page */}
      <div className="flex flex-col gap-2" style={{ flex: '7 1 0%' }}>
        <span className="text-xs font-semibold uppercase text-muted-foreground">Live view</span>
        <StreamTapPanel serial={serial} />
      </div>

      {/* ~30% of the page */}
      <div className="flex flex-col gap-2" style={{ flex: '3 1 0%' }}>
        <span className="text-xs font-semibold uppercase text-muted-foreground">Reset</span>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border border-border bg-card p-3">
          <p className="text-justify font-mono text-xs text-muted-foreground">
            Wipes the camera's settings and puts it back into pairing mode.{' '}
            <strong className="text-foreground">Make sure the camera is connected first</strong> -
            this won't work otherwise.
          </p>

          {resetState === 'done' ? (
            <p className="rounded-xl bg-lime/10 p-2 text-xs text-lime">
              Factory reset sent - the camera should reboot into pairing mode shortly.
            </p>
          ) : resetState === 'confirming' ? (
            <div className="flex flex-col gap-2 rounded-xl bg-destructive/10 p-2">
              <span className="flex items-center gap-2 text-xs font-semibold text-destructive uppercase">
                <AlertTriangle className="size-4" />
                This wipes all config - irreversible
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
            <div className="flex items-center gap-2 rounded-xl bg-muted p-2 text-xs font-medium">
              <Loader2 className="size-4 animate-spin" />
              Sending reset command…
            </div>
          ) : (
            <>
              {resetState === 'error' && (
                <p className="rounded-xl bg-destructive/10 p-2 text-xs text-destructive">Reset failed: {resetError}</p>
              )}
              <Button variant="destructive" onClick={() => setResetState('confirming')}>
                <Trash2 />
                Reset for redeployment
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
