import { Camera, LogOut, Moon, ShieldCheck, Sun, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type DashboardPage = 'cameras' | 'users'

interface DashboardHeaderProps {
  page: DashboardPage
  onSelectPage: (page: DashboardPage) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onLogout: () => void
}

const TABS: { id: DashboardPage; label: string; icon: typeof Camera }[] = [
  { id: 'cameras', label: 'Cameras', icon: Camera },
  { id: 'users', label: 'Users', icon: Users },
]

/** Shared across every /dashboard page - branding, page tabs, theme toggle, sign out. */
export function DashboardHeader({ page, onSelectPage, theme, onToggleTheme, onLogout }: DashboardHeaderProps) {
  return (
    <div className="border-b border-border">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="glow-primary flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-xl leading-tight font-black tracking-tight uppercase">Dashboard</h1>
            <p className="text-xs text-muted-foreground">CCTV pairing - admin</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </div>
      <div className="mx-auto flex max-w-4xl gap-1 px-5 pb-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = page === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectPage(id)}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
