import { Bluetooth, Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { DeviceScanner } from '@/components/DeviceScanner'
import { LogConsole } from '@/components/LogConsole'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'
import { setAdminKey } from '@/lib/api/config'

// Lets a bookmarked/shared link carry the admin key so it only needs
// entering once per device instead of every time the prompt appears — the
// key itself never lives in this file or the built bundle, only the logic
// to pick it up from the URL and immediately scrub it from the address bar.
function useAdminKeyFromUrl(): void {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const key = params.get('adminKey')
    if (!key) return

    setAdminKey(key)
    params.delete('adminKey')
    const rest = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))
  }, [])
}

export default function App() {
  const { theme, toggleTheme } = useTheme()
  useAdminKeyFromUrl()

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
        <DeviceScanner />
      </div>
      <LogConsole />
    </div>
  )
}
