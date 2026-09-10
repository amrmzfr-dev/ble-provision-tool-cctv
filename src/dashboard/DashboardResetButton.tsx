import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { resetDashboardCamera } from '@/lib/api/dashboardClient'
import { DashboardApiError } from '@/lib/api/dashboardConfig'

interface DashboardResetButtonProps {
  serial: string
  /** Called after a successful reset, so the calling page can re-fetch its list. */
  onReset?: () => void
}

/**
 * Factory-reset action shared by both camera tables (Camera Ledger and All
 * Cameras) - same real backend call the tester app's own "Reset for
 * redeployment" button makes (DashboardController.ResetCamera), just
 * reachable here for any serial the dashboard knows about, paired through
 * this tool or not. Only works while the camera is actively connected; the
 * real backend's refusal otherwise comes through as the error shown below.
 */
export function DashboardResetButton({ serial, onReset }: DashboardResetButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async () => {
    setResetting(true)
    setError(null)
    try {
      await resetDashboardCamera(serial)
      setConfirming(false)
      onReset?.()
    } catch (err) {
      setError(err instanceof DashboardApiError ? err.message : 'Reset failed.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-destructive hover:text-destructive"
        onClick={() => {
          setError(null)
          setConfirming(true)
        }}
        aria-label={`Reset ${serial}`}
        title="Factory reset"
      >
        <RotateCcw className="size-4" />
      </Button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => !resetting && setConfirming(false)}
        >
          <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase">
              <AlertTriangle className="size-4 text-destructive" />
              Factory reset this camera?
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              <code className="text-foreground">{serial}</code> will be wiped and reboot into pairing mode. Only
              works while it's actively connected - this can't be undone.
            </p>
            {error && <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)} disabled={resetting}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" disabled={resetting} onClick={() => void handleReset()}>
                {resetting ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
