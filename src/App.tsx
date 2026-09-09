import { Moon, Sun } from 'lucide-react'
import { DeviceScanner } from '@/components/DeviceScanner'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

export default function App() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-svh bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-10">
        <div className="flex w-full items-center justify-between">
          <h1 className="text-lg font-semibold">Camera BLE Provisioning</h1>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </div>
        <DeviceScanner />
      </div>
    </div>
  )
}
