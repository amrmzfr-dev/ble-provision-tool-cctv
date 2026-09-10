import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { listDashboardCameras, type DashboardCamera } from '@/lib/api/dashboardClient'
import { DashboardApiError } from '@/lib/api/dashboardConfig'
import { cn } from '@/lib/utils'
import { DASHBOARD_PAGE_SIZE, DashboardPagination } from './DashboardPagination'

type ConnectionFilter = 'all' | 'online' | 'offline'
type PicFilter = 'all' | 'checked' | 'unchecked'
type SortOrder = 'newest' | 'oldest'

const SELECT_CLASS =
  'h-9 rounded-xl border border-input bg-card px-2.5 font-mono text-xs text-foreground outline-none focus-visible:border-ring'
const ROW_HEIGHT = 'h-12'
const COLUMN_COUNT = 7

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
  const [page, setPage] = useState(1)
  const [connectionFilter, setConnectionFilter] = useState<ConnectionFilter>('all')
  const [picFilter, setPicFilter] = useState<PicFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')

  const load = async () => {
    setLoading(true)
    try {
      const data = await listDashboardCameras()
      setCameras(data)
      setPage(1)
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

  const visibleCameras = useMemo(() => {
    if (!cameras) return []
    let list = cameras
    if (connectionFilter !== 'all') {
      const wantConnected = connectionFilter === 'online'
      list = list.filter((c) => (c.lastStatus === 'connected') === wantConnected)
    }
    if (picFilter !== 'all') {
      const wantChecked = picFilter === 'checked'
      list = list.filter((c) => (c.lastCheckedByName !== null) === wantChecked)
    }
    return [...list].sort((a, b) => {
      const aTime = new Date(a.addedAt).getTime()
      const bTime = new Date(b.addedAt).getTime()
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime
    })
  }, [cameras, connectionFilter, picFilter, sortOrder])

  const totalPages = Math.max(1, Math.ceil(visibleCameras.length / DASHBOARD_PAGE_SIZE))
  const pageCameras = visibleCameras.slice((page - 1) * DASHBOARD_PAGE_SIZE, page * DASHBOARD_PAGE_SIZE)
  // Pads the current page out to a full DASHBOARD_PAGE_SIZE rows with blank
  // filler rows, so the table's rendered height stays constant across pages
  // and filters instead of shrinking whenever fewer rows happen to match.
  const fillerRowCount = Math.max(0, DASHBOARD_PAGE_SIZE - pageCameras.length)

  return (
    <div className="flex flex-col gap-4 px-5 py-6">
      <h1 className="text-lg leading-tight font-black tracking-tight uppercase">Camera Ledger</h1>

      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3">
        {cameras && cameras.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <select
              className={SELECT_CLASS}
              value={connectionFilter}
              onChange={(e) => updateConnectionFilter(e.target.value as ConnectionFilter)}
              aria-label="Filter by connection"
            >
              <option value="all">All connections</option>
              <option value="online">Connected only</option>
              <option value="offline">Not connected only</option>
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
              aria-label="Sort by configured time"
            >
              <option value="newest">Newest configured first</option>
              <option value="oldest">Oldest configured first</option>
            </select>
          </div>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">Who configured and last tested each camera</p>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {cameras === null && !error ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : cameras && cameras.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cameras paired yet.</p>
      ) : visibleCameras.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cameras match this filter.</p>
      ) : (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="p-3 font-semibold">#</th>
                  <th className="p-3 font-semibold">Serial</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">PIC name</th>
                  <th className="p-3 font-semibold">Configured at</th>
                  <th className="p-3 font-semibold">Last tested by</th>
                  <th className="p-3 font-semibold">Last tested at</th>
                </tr>
              </thead>
              <tbody>
                {pageCameras.map((c, i) => (
                  <tr key={c.serial} className={cn(ROW_HEIGHT, 'border-t border-border')}>
                    <td className="p-3 text-muted-foreground">{(page - 1) * DASHBOARD_PAGE_SIZE + i + 1}</td>
                    <td className="p-3 font-mono whitespace-nowrap">{c.serial}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase', statusTone(c.lastStatus))}>
                        {c.lastStatus ?? 'unknown'}
                      </span>
                    </td>
                    <td className="p-3 font-medium uppercase whitespace-nowrap">{c.configuredByName ?? '—'}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">{formatDate(c.addedAt)}</td>
                    <td className="p-3 uppercase whitespace-nowrap">{c.lastCheckedByName ?? '—'}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">{formatDate(c.lastStatusAt)}</td>
                  </tr>
                ))}
                {Array.from({ length: fillerRowCount }, (_, i) => (
                  <tr key={`filler-${i}`} className={cn(ROW_HEIGHT, 'border-t border-border')}>
                    <td colSpan={COLUMN_COUNT} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DashboardPagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
