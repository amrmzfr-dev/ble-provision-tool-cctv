import { Bluetooth, Camera as CameraIcon, LogOut, Moon, Sun } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { DeviceScanner } from '@/components/DeviceScanner'
import { LoginScreen } from '@/components/LoginScreen'
import { LogConsole } from '@/components/LogConsole'
import { MyCamerasScreen } from '@/components/screens/MyCamerasScreen'
import { StreamScreen } from '@/components/screens/StreamScreen'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'
import { clearAuthToken, getAuthToken, subscribeAuthToken } from '@/lib/api/config'

type View = { name: 'pairing' } | { name: 'my-cameras' } | { name: 'stream'; serial: string }

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const authToken = useSyncExternalStore(subscribeAuthToken, getAuthToken)
  const [view, setView] = useState<View>({ name: 'pairing' })

  return (
    <div className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-full max-w-lg -translate-x-1/2 rounded-full bg-primary/25 blur-3xl"
      />
      <div className="relative mx-auto flex max-w-md flex-col gap-6 px-5 py-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="glow-primary flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-destructive text-primary-foreground">
              <Bluetooth className="size-6" />
            </div>
            <div>
              <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Perodua smart charger
              </span>
              <h1 className="text-3xl leading-[0.92] font-black tracking-tight uppercase">
                CCTV Pairing
              </h1>
            </div>
          </div>
          <div className="flex gap-2">
            {authToken && (
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setView(view.name === 'pairing' ? { name: 'my-cameras' } : { name: 'pairing' })}
                aria-label={view.name === 'pairing' ? 'My cameras' : 'New pairing'}
                className="border border-border"
              >
                {view.name === 'pairing' ? <CameraIcon /> : <Bluetooth />}
              </Button>
            )}
            {authToken && (
              <Button
                variant="secondary"
                size="icon"
                onClick={clearAuthToken}
                aria-label="Sign out"
                className="border border-border"
              >
                <LogOut />
              </Button>
            )}
            <Button
              variant="secondary"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="border border-border"
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
        {!authToken ? (
          <LoginScreen />
        ) : view.name === 'pairing' ? (
          <DeviceScanner />
        ) : view.name === 'my-cameras' ? (
          <MyCamerasScreen
            onBack={() => setView({ name: 'pairing' })}
            onOpenStream={(serial) => setView({ name: 'stream', serial })}
          />
        ) : (
          <StreamScreen serial={view.serial} onBack={() => setView({ name: 'my-cameras' })} />
        )}
      </div>
      <LogConsole />
    </div>
  )
}
