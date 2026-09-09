// Relative — this app's own nginx proxies /api/* to the mini backend
// (backend/, BleProvisionApi) server-side (see nginx.conf), so the browser
// only ever talks same-origin. That backend, not the browser, holds the real
// camera backend's X-Admin-Key — the browser only ever needs its own login.
export const API_BASE = '/api'

const AUTH_TOKEN_STORAGE = 'ble-provision-auth-token'

// Tiny pub/sub so App.tsx's login gate (via useSyncExternalStore) reacts
// immediately to a login/logout/expiry — plain localStorage writes don't
// trigger a re-render on their own.
const authListeners = new Set<() => void>()
function notifyAuthChanged(): void {
  for (const listener of authListeners) listener()
}
export function subscribeAuthToken(listener: () => void): () => void {
  authListeners.add(listener)
  return () => authListeners.delete(listener)
}

// Never bake secrets into the build — anything in the bundle is readable by
// anyone who opens the page. This is a JWT from this app's own login, not
// the camera backend's admin key (that never leaves the backend anymore).
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_STORAGE)
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE, token)
  notifyAuthChanged()
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_STORAGE)
  notifyAuthChanged()
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    super(
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : `Request failed with status ${status}`,
    )
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** False only for the login call itself — every other endpoint requires a logged-in session. */
  auth?: boolean
  // Stream tokens are a separate, per-user/per-camera concept from this
  // app's own login — issued at call time by the real camera backend, not a
  // stored secret like the auth token above.
  streamToken?: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
}

function buildHeaders(auth: boolean, streamToken?: string): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (auth) {
    const token = getAuthToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  if (streamToken) headers['X-Stream-Token'] = streamToken
  return headers
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', auth = true, streamToken, body, query } = options

  const url = new URL(API_BASE + path, window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
  }

  const res = await fetch(url, {
    method,
    headers: buildHeaders(auth, streamToken),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && auth) {
    // The token expired or was never valid — this app's own login session is
    // gone. Clearing it here (rather than in every caller) means the next
    // render of the login-gate check in App.tsx sends the user back to the
    // login screen instead of silently failing every request from here on.
    clearAuthToken()
  }

  const contentType = res.headers.get('content-type') ?? ''
  const parsed = contentType.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    throw new ApiError(res.status, parsed)
  }
  return parsed as T
}
