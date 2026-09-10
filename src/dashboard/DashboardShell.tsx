import { Camera, LogOut, Menu, Moon, ShieldCheck, Sun, Users, Video, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type DashboardPage = 'cameras' | 'chargers' | 'users'

const NAV: { id: DashboardPage; label: string; icon: typeof Camera }[] = [
  { id: 'cameras', label: 'Camera Ledger', icon: Camera },
  { id: 'chargers', label: 'All Chargers', icon: Video },
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

function NavLinks({ page, onSelect }: { page: DashboardPage; onSelect: (p: DashboardPage) => void }) {
  return (
    <>
      {NAV.map(({ id, label, icon: Icon }) => {
        const active = page === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        )
      })}
    </>
  )
}

/**
 * Sidebar (desktop) + topbar (page title, theme, sign out) shell wrapping
 * every logged-in /dashboard page. The sidebar collapses into a dropdown off
 * the topbar's menu button below the md breakpoint rather than disappearing
 * outright - a phone-width admin still needs to switch pages somehow.
 */
export function DashboardShell({ page, onSelectPage, theme, onToggleTheme, onLogout, children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const current = NAV.find((n) => n.id === page)

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2.5 p-5">
          <div className="glow-primary flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-sm font-black uppercase tracking-tight">Dashboard</span>
            <span className="block truncate text-[10px] text-muted-foreground uppercase">CCTV Pairing</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          <NavLinks page={page} onSelect={onSelectPage} />
        </nav>
        <div className="p-3">
          <Button variant="outline" className="w-full" onClick={onLogout}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileNavOpen ? <X /> : <Menu />}
            </Button>
            <h1 className="truncate text-lg leading-tight font-black tracking-tight uppercase">{current?.label}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="icon" onClick={onToggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <Button variant="outline" size="icon" className="md:hidden" onClick={onLogout} aria-label="Sign out">
              <LogOut />
            </Button>
          </div>
        </header>

        {mobileNavOpen && (
          <div className="flex flex-col gap-1 border-b border-border p-3 md:hidden">
            <NavLinks
              page={page}
              onSelect={(p) => {
                onSelectPage(p)
                setMobileNavOpen(false)
              }}
            />
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
