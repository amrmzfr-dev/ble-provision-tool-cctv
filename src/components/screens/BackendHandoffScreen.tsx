import { CheckCircle2, KeyRound, Loader2, RotateCcw, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getDeviceStatus, postWifiConfigured } from '@/lib/api/client'
import { ApiError, getClientKey, setClientKey } from '@/lib/api/config'
import type { DeviceStatus } from '@/lib/api/types'

const POLL_INTERVAL_MS = 4000
const POLL_TIMEOUT_MS = 6 * 60 * 1000 // slightly past the backend's own 5-minute window

interface BackendHandoffScreenProps {
  serial: string
  onDone: () => void
  onRetryWifi: () => void
}

type Phase = 'need-key' | 'submitting' | 'waiting' | 'connected' | 'failed'

export function BackendHandoffScreen({ serial, onDone, onRetryWifi }: BackendHandoffScreenProps) {
  const [phase, setPhase] = useState<Phase>(getClientKey() ? 'submitting' : 'need-key')
  const [keyInput, setKeyInput] = useState('')
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollStartRef = useRef<number | null>(null)

  useEffect(() => {
    if (phase !== 'submitting') return
    let cancelled = false

    postWifiConfigured(serial)
      .then(() => {
        if (cancelled) return
        pollStartRef.current = Date.now()
        setPhase('waiting')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : String(err))
        setPhase('failed')
      })

    return () => {
      cancelled = true
    }
  }, [phase, serial])

  useEffect(() => {
    if (phase !== 'waiting') return
    let cancelled = false

    const poll = async () => {
      try {
        const result = await getDeviceStatus(serial)
        if (cancelled) return
        setStatus(result)

        if (result.status === 'connected') {
          setPhase('connected')
          return
        }
        if (['connection_timeout', 'login_failed', 'password_error', 'serial_mismatch'].includes(result.status)) {
          setError(result.status_description)
          setPhase('failed')
          return
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : String(err))
        setPhase('failed')
        return
      }

      if (Date.now() - (pollStartRef.current ?? Date.now()) > POLL_TIMEOUT_MS) {
        setError("The camera hasn't come online within the expected window.")
        setPhase('failed')
        return
      }
      if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [phase, serial])

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Step 6 of 6
        </span>
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">
          Connecting to the server
        </h2>
      </div>

      {phase === 'need-key' && (
        <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-tight">
            <KeyRound className="size-4" />
            Client API key needed
          </span>
          <p className="text-xs text-muted-foreground">
            Needed to tell the backend WiFi was configured. Kept only in this browser
            (localStorage), never sent anywhere but api.czeros.tech.
          </p>
          <Input
            autoFocus
            type="password"
            placeholder="X-Client-Key"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <div className="flex-1" />
          <Button
            disabled={!keyInput}
            onClick={() => {
              setClientKey(keyInput)
              setPhase('submitting')
            }}
            size="lg"
          >
            Continue
          </Button>
        </div>
      )}

      {(phase === 'submitting' || phase === 'waiting') && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-5 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <div>
            <p className="text-sm font-semibold">
              {phase === 'submitting' ? 'Telling the server WiFi is set…' : 'Waiting for the camera to come online…'}
            </p>
            {status && (
              <p className="mt-1 font-mono text-xs text-muted-foreground uppercase">
                {status.status_description}
              </p>
            )}
          </div>
        </div>
      )}

      {phase === 'connected' && (
        <div className="glow-lime flex flex-1 flex-col gap-3 rounded-2xl bg-lime p-5 text-[#0c0c0c]">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-10 shrink-0" strokeWidth={1.5} />
            <span className="text-lg leading-tight font-black uppercase tracking-tight">
              Camera online
            </span>
          </div>
          <p className="text-sm">
            <span className="opacity-70">Serial: </span>
            <code className="font-mono font-medium">{serial}</code>
          </p>
          <div className="flex-1" />
          <Button variant="outline" onClick={onDone} className="border-current/30 bg-transparent">
            Done
          </Button>
        </div>
      )}

      {phase === 'failed' && (
        <div className="glow-destructive flex flex-1 flex-col gap-3 rounded-2xl bg-destructive p-5 text-white dark:text-[#0c0c0c]">
          <div className="flex items-center gap-3">
            <XCircle className="size-10 shrink-0" strokeWidth={1.5} />
            <span className="text-lg leading-tight font-black uppercase tracking-tight">
              Didn't connect
            </span>
          </div>
          <p className="text-sm">{error}</p>
          <div className="flex-1" />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 border-current/30 bg-transparent"
              onClick={onRetryWifi}
            >
              Fix WiFi & retry
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-current/30 bg-transparent"
              onClick={() => setPhase('submitting')}
            >
              <RotateCcw />
              Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
