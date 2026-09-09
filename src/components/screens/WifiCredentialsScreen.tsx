import { Eye, EyeOff, Wifi } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface WifiCredentialsScreenProps {
  deviceName: string
  serialMatch: boolean
  initialError?: string | null
  onSubmit: (ssid: string, password: string) => void
}

export function WifiCredentialsScreen({
  deviceName,
  serialMatch,
  initialError,
  onSubmit,
}: WifiCredentialsScreenProps) {
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Step 3 of 5
        </span>
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">
          WiFi for the camera
        </h2>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Connected to <code className="font-mono font-medium text-foreground">{deviceName}</code>
          </span>
          <Badge variant={serialMatch ? 'success' : 'destructive'}>
            {serialMatch ? 'serial matches' : 'check this is the right camera'}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        {initialError && (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{initialError}</p>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold uppercase tracking-tight">Network name</span>
          <Input
            autoFocus
            placeholder="SSID"
            maxLength={32}
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold uppercase tracking-tight">Password</span>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="WiFi password"
              maxLength={64}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex-1" />

        <Button size="lg" disabled={!ssid} onClick={() => onSubmit(ssid, password)}>
          <Wifi />
          Send to the camera
        </Button>
      </div>
    </div>
  )
}
