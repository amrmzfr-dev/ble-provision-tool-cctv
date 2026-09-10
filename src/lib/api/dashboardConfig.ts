// Separate, minimal fetch + token storage for /dashboard - deliberately not
// sharing lib/api/config.ts's tester auth token. The dashboard admin and a
// logged-in tester are different identities that can coexist in the same
// browser; each area should only ever know about its own login.
import { API_BASE } from './config'

const DASHBOARD_TOKEN_STORAGE = 'ble-provision-dashboard-token'

const listeners = new Set<() => void>()
function notify(): void {
  for (const listener of listeners) listener()
}
export function subscribeDashboardToken(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getDashboardToken(): string | null {
  return localStorage.getItem(DASHBOARD_TOKEN_STORAGE)
}
export function setDashboardToken(token: string): void {
  localStorage.setItem(DASHBOARD_TOKEN_STORAGE, token)
  notify()
}
export function clearDashboardToken(): void {
  localStorage.removeItem(DASHBOARD_TOKEN_STORAGE)
  notify()
}

export class DashboardApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'DashboardApiError'
    this.status = status
  }
}

export async function dashboardFetch<T>(path: string): Promise<T> {
  const token = getDashboardToken()
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  // A non-admin token (or an expired/invalid one) reads the same here - 401
  // means "not logged in", 403 means "logged in but not an admin" - both
  // send the user back to the dashboard's own login screen either way.
  if (res.status === 401 || res.status === 403) {
    clearDashboardToken()
  }

  const contentType = res.headers.get('content-type') ?? ''
  const parsed: unknown = contentType.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    const message =
      typeof parsed === 'object' && parsed !== null && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : `Request failed with status ${res.status}`
    throw new DashboardApiError(res.status, message)
  }
  return parsed as T
}
