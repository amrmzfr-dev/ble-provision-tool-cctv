import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { listDashboardAllCameras, type DashboardAllCamera } from '@/lib/api/dashboardAllCamerasClient'
import { DashboardApiError } from '@/lib/api/dashboardConfig'
import { cn } from '@/lib/utils'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

/**
 * Every camera the real camera backend has ever registered, system-wide -
 * not scoped to this tool at all, unlike the Camera Ledger (which only
 * knows about serials paired through this app). Comes straight from
 * cctv.czeros.tech's own admin/cameras endpoint via the server-side
 * X-Admin-Key (DashboardAllCamerasController) - never exposed to the browser.
 */
export function DashboardAllCamerasPage() {
  const [cameras, setCameras] = useState<DashboardAllCamera[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await listDashboardAllCameras()
      setCameras(data)
      setError(null)
    } catch (err) {
      setError(err instanceof DashboardApiError ? err.message : 'Could not load the camera list.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onlineCount = cameras?.filter((c) => c.connected).length ?? 0

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {cameras ? `${onlineCount} online / ${cameras.length} total` : 'Every camera the real backend knows about'}
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {cameras === null && !error ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : cameras && cameras.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cameras registered yet.</p>
      ) : (
        cameras && (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="p-3 font-semibold">Serial</th>
                  <th className="p-3 font-semibold">Online</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">IP</th>
                  <th className="p-3 font-semibold">PIC name</th>
                  <th className="p-3 font-semibold">Registered</th>
                </tr>
              </thead>
              <tbody>
                {cameras.map((c) => (
                  <tr key={c.serial} className="border-t border-border">
                    <td className="p-3 font-mono">{c.serial}</td>
                    <td className="p-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase',
                          c.connected
                            ? 'border-lime/30 bg-lime/15 text-lime'
                            : 'border-border bg-muted text-muted-foreground',
                        )}
                      >
                        <span className={cn('size-1.5 rounded-full', c.connected ? 'bg-lime' : 'bg-muted-foreground')} />
                        {c.connected ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground uppercase">{c.status ?? 'unknown'}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{c.ip ?? '—'}</td>
                    <td className="p-3 font-medium uppercase">{c.picName ?? '—'}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(c.registrationTime)}</td>
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
