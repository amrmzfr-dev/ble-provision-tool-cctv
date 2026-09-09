import { Bluetooth, Loader2, LogIn } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { login } from '@/lib/api/authClient'
import { ApiError, setAuthToken } from '@/lib/api/config'

/**
 * Gates the whole app. Replaced the old per-flow AdminKeyGate: instead of
 * the browser holding the real camera backend's X-Admin-Key directly (in
 * localStorage, sent on every request), it now only ever holds a login for
 * this app's own mini backend — that backend holds the real key server-side
 * and never sends it to the browser.
 */
export function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await login(username, password)
      setAuthToken(res.token)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[560px] flex-1 flex-col items-center justify-center gap-6">
      <div className="glow-primary flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Bluetooth className="size-7" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl leading-tight font-black tracking-tight uppercase">Sign in</h2>
        <p className="mt-1 text-sm text-muted-foreground">CCTV pairing tool — testers only</p>
      </div>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
        <Input
          autoFocus
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" disabled={loading || !username || !password}>
          {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
