import { AlertTriangle, CheckCircle2, KeyRound, Loader2, RotateCcw, Trash2, Video, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminResetDevice, getDeviceStatus, postWifiConfigured } from '@/lib/api/client'
import { ApiError, getAdminKey, setAdminKey } from '@/lib/api/config'
import type { DeviceStatus } from '@/lib/api/types'
import { logEvent } from '@/lib/debugLog'

const POLL_INTERVAL_MS = 4000
const POLL_TIMEOUT_MS = 6 * 60 * 1000 // slightly past the backend's own 5-minute window

interface BackendHandoffScreenProps {
  serial: string
  /** True if PairingScreen already sent wifi-configured right after the WiFi ack — skip straight to polling instead of sending it again. */
  alreadyNotified: boolean
  onDone: () => void
  onRetryWifi: () => void
  onViewStream: () => void
  /** Bail out while still submitting/waiting — the poll has no other exit besides connecting or a 6-minute timeout. */
  onCancel: () => void
}

type Phase = 'need-key' | 'submitting' | 'waiting' | 'connected' | 'failed'

export function BackendHandoffScreen({ serial, alreadyNotified, onDone, onRetryWifi, onViewStream, onCancel }: BackendHandoffScreenProps) {
  const [phase, setPhase] = useState<Phase>(() => {
    if (alreadyNotified) return 'waiting'
    return getAdminKey() ? 'submitting' : 'need-key'
  })
  const [keyInput, setKeyInput] = useState('')
  const [status, setStatus] = useState<DeviceStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollStartRef = useRef<number | null>(alreadyNotified ? Date.now() : null)
  const [resetState, setResetState] = useState<'idle' | 'confirming' | 'resetting' | 'done' | 'error'>('idle')
  const [resetError, setResetError] = useState<string | null>(null)

  useEffect(() => {
    if (phase !== 'submitting') return
    let cancelled = false

    logEvent('tx', `POST /device/${serial}/provisioning/wifi-configured`)
    postWifiConfigured(serial)
      .then((res) => {
        if (cancelled) return
        logEvent('success', `wifi-configured accepted: ${JSON.stringify(res)}`)
        pollStartRef.current = Date.now()
        setPhase('waiting')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof ApiError ? err.message : String(err)
        logEvent('error', `wifi-configured failed: ${message}`)
        setError(message)
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
        logEvent('tx', `GET /device/${serial}/status`)
        const result = await getDeviceStatus(serial)
        if (cancelled) return
        logEvent('rx', `status=${result.status} — ${result.status_description}`)
        setStatus(result)

        if (result.status === 'connected') {
          logEvent('success', 'Camera connected')
          setPhase('connected')
          return
        }
        if (['connection_timeout', 'login_failed', 'password_error', 'serial_mismatch'].includes(result.status)) {
          logEvent('error', `Terminal status: ${result.status}`)
          setError(result.status_description)
          setPhase('failed')
          return
        }
      } catch (err) {
        if (cancelled) return
        const message = err instanceof ApiError ? err.message : String(err)
        logEvent('error', `Status poll failed: ${message}`)
        setError(message)
        setPhase('failed')
        return
      }

      if (Date.now() - (pollStartRef.current ?? Date.now()) > POLL_TIMEOUT_MS) {
        logEvent('error', `Gave up after ${POLL_TIMEOUT_MS}ms of polling`)
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

  const handleReset = async () => {
    setResetState('resetting')
    setResetError(null)
    logEvent('tx', `POST /admin/device/${serial}/reset (factory_reset=true)`)
    try {
      await adminResetDevice(serial, true)
      logEvent('success', `Factory reset command sent for ${serial}`)
      setResetState('done')
    } catch (err) {
      // Only works while the camera's still connected — see the doc comment
      // on adminResetDevice. A stale registration (ip/port never set, or the
      // camera already dropped) fails here, not a permissions problem.
      const message = err instanceof ApiError ? err.message : String(err)
      logEvent('error', `Reset failed: ${message}`)
      setResetError(message)
      setResetState('error')
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <span className="block font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Step 5 of 5
        </span>
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">
          Connecting to the server
        </h2>
      </div>

      {phase === 'need-key' && (
        <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-tight">
            <KeyRound className="size-4" />
            Admin API key needed
          </span>
          <p className="text-xs text-muted-foreground">
            Needed to tell the backend WiFi was configured. Kept only in this browser
            (localStorage), never sent anywhere but cctv.czeros.tech.
          </p>
          <Input
            autoFocus
            type="password"
            placeholder="X-Admin-Key"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <div className="flex-1" />
          <Button
            disabled={!keyInput}
            onClick={() => {
              setAdminKey(keyInput)
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
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
            Cancel and go back home
          </Button>
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

          {resetState === 'done' ? (
            <p className="rounded-xl bg-[#0c0c0c]/10 p-3 text-xs font-medium">
              Factory reset sent — the camera should reboot into pairing mode shortly.
            </p>
          ) : resetState === 'confirming' ? (
            <div className="flex flex-col gap-2 rounded-xl bg-[#0c0c0c]/10 p-3">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase">
                <AlertTriangle className="size-4" />
                Factory reset — wipes all config, irreversible
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-current/30 bg-transparent"
                  onClick={() => setResetState('idle')}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => void handleReset()}
                >
                  Yes, reset it
                </Button>
              </div>
            </div>
          ) : resetState === 'resetting' ? (
            <div className="flex items-center gap-2 rounded-xl bg-[#0c0c0c]/10 p-3 text-xs font-medium">
              <Loader2 className="size-4 animate-spin" />
              Sending reset command…
            </div>
          ) : (
            resetState === 'error' && (
              <p className="rounded-xl bg-[#0c0c0c]/10 p-3 text-xs font-medium">
                Reset failed: {resetError}. This only works while the camera is still actively
                connected — if it's already dropped, this won't succeed; use the physical reset
                instead.
              </p>
            )
          )}

          <div className="flex-1" />

          <div className="flex flex-col gap-2">
            {resetState === 'idle' && (
              <Button
                variant="outline"
                className="border-current/30 bg-transparent"
                onClick={onViewStream}
              >
                <Video />
                View live stream
              </Button>
            )}
            <div className="flex gap-2">
              {resetState === 'idle' && (
                <Button
                  variant="outline"
                  className="flex-1 border-current/30 bg-transparent"
                  onClick={() => setResetState('confirming')}
                >
                  <Trash2 />
                  Reset for redeployment
                </Button>
              )}
              <Button
                variant="outline"
                onClick={onDone}
                className={resetState === 'idle' ? 'border-current/30 bg-transparent' : 'flex-1 border-current/30 bg-transparent'}
              >
                Done
              </Button>
            </div>
          </div>
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
