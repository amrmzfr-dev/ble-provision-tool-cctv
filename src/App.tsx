import { AlertTriangle, Bluetooth } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { BottomNav, type NavTab } from '@/components/BottomNav'
import { DeviceScanner } from '@/components/DeviceScanner'
import { LoginScreen } from '@/components/LoginScreen'
import { LogConsole } from '@/components/LogConsole'
import { CameraDetailScreen } from '@/components/screens/CameraDetailScreen'
import { MyCamerasScreen } from '@/components/screens/MyCamerasScreen'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'
import { clearAuthToken, getAuthToken, subscribeAuthToken } from '@/lib/api/config'

type View = { name: 'pairing' } | { name: 'my-cameras' } | { name: 'camera-detail'; serial: string }

function viewToTab(view: View): NavTab {
  // The detail screen is only ever reached from My Cameras, so it stays
  // grouped under that tab for highlighting purposes.
  return view.name === 'pairing' ? 'pairing' : 'my-cameras'
}

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const authToken = useSyncExternalStore(subscribeAuthToken, getAuthToken)
  const [view, setView] = useState<View>({ name: 'pairing' })
  const [confirmingLogout, setConfirmingLogout] = useState(false)

  return (
    <div className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <div className={`relative mx-auto flex max-w-md flex-col gap-6 px-5 pt-4 pb-10 ${authToken ? 'pb-24' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="glow-primary flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Bluetooth className="size-6" />
            </div>
            <div>
              <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Perodua smart charger
              </span>
              <h1 className="text-xl leading-[0.95] font-black tracking-tight uppercase">
                CCTV Pairing
              </h1>
            </div>
          </div>
        </div>
        {!authToken ? (
          <LoginScreen />
        ) : view.name === 'pairing' ? (
          <DeviceScanner />
        ) : view.name === 'my-cameras' ? (
          <MyCamerasScreen onOpenCamera={(serial) => setView({ name: 'camera-detail', serial })} />
        ) : (
          <CameraDetailScreen
            serial={view.serial}
            onBack={() => setView({ name: 'my-cameras' })}
            onRemoved={() => setView({ name: 'my-cameras' })}
          />
        )}
      </div>
      <LogConsole />

      {authToken && (
        <BottomNav
          active={viewToTab(view)}
          onSelect={(tab) => setView(tab === 'pairing' ? { name: 'pairing' } : { name: 'my-cameras' })}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogoutClick={() => setConfirmingLogout(true)}
        />
      )}

      {confirmingLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5">
          <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase">
              <AlertTriangle className="size-4 text-destructive" />
              Sign out?
            </div>
            <p className="mt-1 text-xs text-muted-foreground">You'll need to log in again to keep testing.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmingLogout(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  setConfirmingLogout(false)
                  clearAuthToken()
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
