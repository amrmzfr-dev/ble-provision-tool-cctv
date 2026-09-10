import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { listDashboardAllCameras, type DashboardAllCamera } from '@/lib/api/dashboardAllCamerasClient'
import { DashboardApiError } from '@/lib/api/dashboardConfig'
import { cn } from '@/lib/utils'
import { DASHBOARD_PAGE_SIZE, DashboardPagination } from './DashboardPagination'

type ConnectionFilter = 'all' | 'online' | 'offline'
type PicFilter = 'all' | 'checked' | 'unchecked'
type SortOrder = 'newest' | 'oldest'

const SELECT_CLASS =
  'h-9 rounded-xl border border-input bg-transparent px-2.5 font-mono text-xs outline-none focus-visible:border-ring'

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
  const [page, setPage] = useState(1)
  const [connectionFilter, setConnectionFilter] = useState<ConnectionFilter>('all')
  const [picFilter, setPicFilter] = useState<PicFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')

  const load = async () => {
    setLoading(true)
    try {
      const data = await listDashboardAllCameras()
      setCameras(data)
      setPage(1)
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

  // Whenever a filter/sort changes, land back on page 1 - staying on e.g.
  // page 3 after narrowing the list down to nothing there would just look
  // like an empty result for no visible reason.
  const updateConnectionFilter = (value: ConnectionFilter) => {
    setConnectionFilter(value)
    setPage(1)
  }
  const updatePicFilter = (value: PicFilter) => {
    setPicFilter(value)
    setPage(1)
  }
  const updateSortOrder = (value: SortOrder) => {
    setSortOrder(value)
    setPage(1)
  }

  const onlineCount = cameras?.filter((c) => c.connected).length ?? 0

  const visibleCameras = useMemo(() => {
    if (!cameras) return []
    let list = cameras
    if (connectionFilter !== 'all') {
      const wantConnected = connectionFilter === 'online'
      list = list.filter((c) => c.connected === wantConnected)
    }
    if (picFilter !== 'all') {
      const wantChecked = picFilter === 'checked'
      list = list.filter((c) => (c.picName !== null) === wantChecked)
    }
    return [...list].sort((a, b) => {
      const aTime = a.registrationTime ? new Date(a.registrationTime).getTime() : 0
      const bTime = b.registrationTime ? new Date(b.registrationTime).getTime() : 0
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime
    })
  }, [cameras, connectionFilter, picFilter, sortOrder])

  const totalPages = Math.max(1, Math.ceil(visibleCameras.length / DASHBOARD_PAGE_SIZE))
  const pageCameras = visibleCameras.slice((page - 1) * DASHBOARD_PAGE_SIZE, page * DASHBOARD_PAGE_SIZE)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {cameras ? `${onlineCount} online / ${cameras.length} total` : 'Every camera the real backend knows about'}
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {cameras && cameras.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <select
            className={SELECT_CLASS}
            value={connectionFilter}
            onChange={(e) => updateConnectionFilter(e.target.value as ConnectionFilter)}
            aria-label="Filter by connection"
          >
            <option value="all">All connections</option>
            <option value="online">Online only</option>
            <option value="offline">Offline only</option>
          </select>
          <select
            className={SELECT_CLASS}
            value={picFilter}
            onChange={(e) => updatePicFilter(e.target.value as PicFilter)}
            aria-label="Filter by PIC"
          >
            <option value="all">All PIC status</option>
            <option value="checked">Checked by PIC</option>
            <option value="unchecked">No PIC check</option>
          </select>
          <select
            className={SELECT_CLASS}
            value={sortOrder}
            onChange={(e) => updateSortOrder(e.target.value as SortOrder)}
            aria-label="Sort by registered time"
          >
            <option value="newest">Newest registered first</option>
            <option value="oldest">Oldest registered first</option>
          </select>
        </div>
      )}

      {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {cameras === null && !error ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : cameras && cameras.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cameras registered yet.</p>
      ) : visibleCameras.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cameras match this filter.</p>
      ) : (
        <>
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
                {pageCameras.map((c) => (
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
          <DashboardPagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
