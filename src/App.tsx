import { Moon, Sun } from 'lucide-react'
import { DeviceScanner } from '@/components/DeviceScanner'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

export default function App() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-5 py-10">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Perodua smart charger
            </span>
            <h1 className="text-4xl leading-[0.92] font-black tracking-tight uppercase">
              CCTV
              <br />
              Pairing
            </h1>
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
    </div>
  )
}
