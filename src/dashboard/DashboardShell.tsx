import { Camera, LogOut, Moon, ShieldCheck, Sun, Users, Video } from 'lucide-react'
import { type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type DashboardPage = 'cameras' | 'all-cameras' | 'users'

const NAV: { id: DashboardPage; label: string; icon: typeof Camera }[] = [
  { id: 'cameras', label: 'Camera Ledger', icon: Camera },
  { id: 'all-cameras', label: 'All Cameras', icon: Video },
  { id: 'users', label: 'Users', icon: Users },
]

interface DashboardShellProps {
  page: DashboardPage
  onSelectPage: (page: DashboardPage) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onLogout: () => void
  children: ReactNode
}

/**
 * Sidebar-only shell wrapping every logged-in /dashboard page - no topbar.
 * Always visible rather than collapsing behind a menu button: icon-only at
 * phone width, labeled at md+, so a narrow screen still has a working way
 * to switch pages without a hamburger/topbar to hold the trigger.
 */
export function DashboardShell({ page, onSelectPage, theme, onToggleTheme, onLogout, children }: DashboardShellProps) {
  return (
    <div className="flex min-h-svh">
      <aside className="flex w-16 shrink-0 flex-col border-r border-border bg-card md:w-60">
        <div className="flex items-center gap-2.5 p-3 md:p-5">
          <div className="glow-primary flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div className="hidden min-w-0 md:block">
            <span className="block truncate text-sm font-black uppercase tracking-tight">Dashboard</span>
            <span className="block truncate text-[10px] text-muted-foreground uppercase">CCTV Pairing</span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2 md:px-3">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = page === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectPage(id)}
                aria-label={label}
                title={label}
                className={cn(
                  'flex items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors md:justify-start',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="hidden truncate md:inline">{label}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex flex-col gap-2 p-2 md:p-3">
          <Button variant="outline" size="icon" className="w-full" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <Button variant="outline" size="icon" className="w-full md:hidden" onClick={onLogout} aria-label="Sign out">
            <LogOut />
          </Button>
          <Button variant="outline" className="hidden w-full md:flex" onClick={onLogout}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
