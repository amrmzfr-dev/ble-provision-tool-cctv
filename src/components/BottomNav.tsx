import { Bluetooth, Camera as CameraIcon, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export type NavTab = 'pairing' | 'my-cameras'

interface BottomNavProps {
  active: NavTab
  onSelect: (tab: NavTab) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onLogoutClick: () => void
}

const TABS: { id: NavTab; label: string; icon: typeof Bluetooth }[] = [
  { id: 'pairing', label: 'Pair', icon: Bluetooth },
  { id: 'my-cameras', label: 'My Cameras', icon: CameraIcon },
]

export function BottomNav({ active, onSelect, theme, onToggleTheme, onLogoutClick }: BottomNavProps) {
  const [trayOpen, setTrayOpen] = useState(false)

  return (
    <>
      {/* Tap-outside-to-close backdrop — sits just under the nav/tray so it
          never blocks their own buttons. */}
      {trayOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setTrayOpen(false)} aria-hidden />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        {trayOpen && (
          <div className="absolute inset-x-0 bottom-full mb-2 px-3">
            <div className="animate-in mx-auto flex max-w-md flex-col gap-1 rounded-2xl border border-border bg-card p-2 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  onToggleTheme()
                  setTrayOpen(false)
                }}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-muted"
              >
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrayOpen(false)
                  onLogoutClick()
                }}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </div>
        )}

        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))]">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTrayOpen(false)
                  onSelect(id)
                }}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('size-5', isActive && 'drop-shadow-[0_0_6px_var(--color-primary)]')} />
                {label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setTrayOpen((open) => !open)}
            aria-label="More"
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
              trayOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Settings className="size-5" />
            More
          </button>
        </div>
      </nav>
    </>
  )
}
