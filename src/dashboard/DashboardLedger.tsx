import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { listDashboardCameras, type DashboardCamera } from '@/lib/api/dashboardClient'
import { DashboardApiError } from '@/lib/api/dashboardConfig'
import { cn } from '@/lib/utils'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
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
 * The actual "who's responsible for this camera" ledger: one row per camera,
 * who paired/configured it (Camera.AddedByUserId) and who last ran a live
 * status check on it (Camera.LastCheckedByUserId) - see
 * backend/Controllers/DashboardController.cs for where the two are joined.
 */
export function DashboardLedger() {
  const [cameras, setCameras] = useState<DashboardCamera[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await listDashboardCameras()
      setCameras(data)
      setError(null)
    } catch (err) {
      setError(err instanceof DashboardApiError ? err.message : 'Could not load the ledger.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg leading-tight font-black tracking-tight uppercase">Camera ledger</h2>
          <p className="text-xs text-muted-foreground">Who configured and last tested each camera</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {cameras === null && !error ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : cameras && cameras.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cameras paired yet.</p>
      ) : (
        cameras && (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="p-3 font-semibold">Serial</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">PIC name</th>
                  <th className="p-3 font-semibold">Configured at</th>
                  <th className="p-3 font-semibold">Last tested by</th>
                  <th className="p-3 font-semibold">Last tested at</th>
                </tr>
              </thead>
              <tbody>
                {cameras.map((c) => (
                  <tr key={c.serial} className="border-t border-border">
                    <td className="p-3 font-mono">{c.serial}</td>
                    <td className="p-3">
                      <span className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase', statusTone(c.lastStatus))}>
                        {c.lastStatus ?? 'unknown'}
                      </span>
                    </td>
                    <td className="p-3 font-medium uppercase">{c.configuredByName ?? '—'}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(c.addedAt)}</td>
                    <td className="p-3 uppercase">{c.lastCheckedByName ?? '—'}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(c.lastStatusAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
