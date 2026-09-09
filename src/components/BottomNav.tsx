import { Bluetooth, Camera as CameraIcon, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NavTab = 'pairing' | 'my-cameras'

interface BottomNavProps {
  active: NavTab
  onSelect: (tab: NavTab) => void
  onLogoutClick: () => void
}

const TABS: { id: NavTab; label: string; icon: typeof Bluetooth }[] = [
  { id: 'pairing', label: 'Pair', icon: Bluetooth },
  { id: 'my-cameras', label: 'My Cameras', icon: CameraIcon },
]

export function BottomNav({ active, onSelect, onLogoutClick }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))]">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
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
          onClick={onLogoutClick}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide transition-colors hover:text-destructive"
        >
          <LogOut className="size-5" />
          Sign out
        </button>
      </div>
    </nav>
  )
}
