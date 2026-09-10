import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const DASHBOARD_PAGE_SIZE = 20

interface DashboardPaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

/** Shared Prev/Next pager for dashboard tables - renders nothing when everything fits on one page. */
export function DashboardPagination({ page, totalPages, onPageChange }: DashboardPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft />
          Prev
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
