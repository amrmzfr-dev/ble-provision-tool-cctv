import { useSyncExternalStore } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { clearDashboardToken, getDashboardToken, subscribeDashboardToken } from '@/lib/api/dashboardConfig'
import { DashboardLedger } from './DashboardLedger'
import { DashboardLoginScreen } from './DashboardLoginScreen'

/**
 * Entirely separate app tree from App.tsx (the tester pairing app), mounted
 * at /dashboard - see main.tsx for the plain pathname check that picks
 * between the two. No router involved: just its own login gate over its own
 * one screen, same pattern as the tester app's LoginScreen/authToken gate.
 */
export function DashboardApp() {
  const { theme, toggleTheme } = useTheme()
  const token = useSyncExternalStore(subscribeDashboardToken, getDashboardToken)

  const handleLogout = () => {
    clearDashboardToken()
    window.history.replaceState(null, '', '/dashboard/login')
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      {!token ? <DashboardLoginScreen /> : <DashboardLedger theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout} />}
    </div>
  )
}
