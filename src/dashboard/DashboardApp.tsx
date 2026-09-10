import { useState, useSyncExternalStore } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { clearDashboardToken, getDashboardToken, subscribeDashboardToken } from '@/lib/api/dashboardConfig'
import { DashboardHeader, type DashboardPage } from './DashboardHeader'
import { DashboardLedger } from './DashboardLedger'
import { DashboardLoginScreen } from './DashboardLoginScreen'
import { DashboardUsersPage } from './DashboardUsersPage'

/**
 * Entirely separate app tree from App.tsx (the tester pairing app), mounted
 * at /dashboard - see main.tsx for the plain pathname check that picks
 * between the two. No router involved: just its own login gate, and a plain
 * page switch (DashboardHeader's tabs) once logged in - same pattern as the
 * tester app's own tab switching in App.tsx.
 */
export function DashboardApp() {
  const { theme, toggleTheme } = useTheme()
  const token = useSyncExternalStore(subscribeDashboardToken, getDashboardToken)
  const [page, setPage] = useState<DashboardPage>('cameras')

  const handleLogout = () => {
    clearDashboardToken()
    window.history.replaceState(null, '', '/dashboard/login')
  }

  if (!token) {
    return (
      <div className="min-h-svh bg-background text-foreground">
        <DashboardLoginScreen />
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <DashboardHeader page={page} onSelectPage={setPage} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout} />
      {page === 'cameras' ? <DashboardLedger /> : <DashboardUsersPage />}
    </div>
  )
}
