import type { DashboardPage } from '@/dashboard/DashboardShell'

// Persists which /dashboard tab (Camera Ledger / All Cameras / Users) was
// active, so a refresh lands back there instead of always resetting to
// Camera Ledger. sessionStorage, not localStorage - matches the tester
// app's own view-state persistence (lib/appViewState.ts): a refresh resumes,
// but actually closing the tab/app still starts fresh next time.
const STORAGE_KEY = 'ble-provision-dashboard-page'

const VALID_PAGES: DashboardPage[] = ['cameras', 'all-cameras', 'users']

export function saveDashboardPage(page: DashboardPage): void {
  sessionStorage.setItem(STORAGE_KEY, page)
}

export function loadDashboardPage(): DashboardPage | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  return VALID_PAGES.includes(raw as DashboardPage) ? (raw as DashboardPage) : null
}
