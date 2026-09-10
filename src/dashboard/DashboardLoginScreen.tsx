import { Loader2, LogIn, ShieldCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { login } from '@/lib/api/authClient'
import { ApiError } from '@/lib/api/config'
import { setDashboardToken } from '@/lib/api/dashboardConfig'

/**
 * Gates /dashboard - a separate login from the tester app's LoginScreen,
 * with its own token (dashboardConfig.ts). Reuses the same /auth/login
 * endpoint (one Users table, one bcrypt/JWT flow for both areas), but only
 * an account with IsAdmin set on the backend is let in here - anyone else's
 * otherwise-valid credentials get rejected with a plain message instead.
 */
export function DashboardLoginScreen() {
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
      if (!res.isAdmin) {
        setError('This account does not have dashboard access.')
        return
      }
      setDashboardToken(res.token)
      window.history.replaceState(null, '', '/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col items-center justify-center gap-6 px-5">
      <div className="glow-primary flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <ShieldCheck className="size-7" />
      </div>
      <div className="text-center">
        <h1 className="text-2xl leading-tight font-black tracking-tight uppercase">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">CCTV pairing ledger - admin only</p>
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
