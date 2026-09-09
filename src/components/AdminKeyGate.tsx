import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setAdminKey } from '@/lib/api/config'

interface AdminKeyGateProps {
  onContinue: () => void
}

/**
 * Blocks entry into the pairing screen until an admin key is saved.
 * Exists specifically so wifi-configured can never be delayed by a user
 * typing the key in mid-pairing — see README's "wifi-configured timing"
 * section for why that delay is dangerous (it reopens the exact race the
 * onWifiSent timing fix was built to close).
 */
export function AdminKeyGate({ onContinue }: AdminKeyGateProps) {
  const [keyInput, setKeyInput] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0c0c0c]/95 p-5">
      <div className="glow-primary flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-destructive text-primary-foreground">
        <KeyRound className="size-7" />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#161616] p-5">
        <span className="text-sm font-semibold text-white uppercase tracking-tight">
          Admin API key needed
        </span>
        <p className="mt-1 text-xs text-white/50">
          Needed before pairing can start — the backend has to be notified the moment WiFi is
          sent, with nothing in between. Kept only in this browser, never sent anywhere but
          cctv.czeros.tech.
        </p>
        <Input
          autoFocus
          type="password"
          placeholder="X-Admin-Key"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          className="mt-3 border-white/15 bg-white/5 text-white placeholder:text-white/30"
        />
        <Button
          disabled={!keyInput}
          onClick={() => {
            setAdminKey(keyInput)
            onContinue()
          }}
          size="lg"
          className="mt-3 w-full"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
