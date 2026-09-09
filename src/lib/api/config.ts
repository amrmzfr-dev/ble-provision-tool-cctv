// Relative — this app's own nginx proxies /api/* to https://api.czeros.tech
// server-side (see nginx.conf), so the browser only ever talks same-origin.
export const API_BASE = '/api'

const CLIENT_KEY_STORAGE = 'ble-provision-client-key'
const ADMIN_KEY_STORAGE = 'ble-provision-admin-key'

// Never bake these into the build — anything in the bundle is readable by
// anyone who opens the page. Prompt once, keep in localStorage instead.
export function getClientKey(): string | null {
  return localStorage.getItem(CLIENT_KEY_STORAGE)
}

export function setClientKey(key: string): void {
  localStorage.setItem(CLIENT_KEY_STORAGE, key)
}

export function getAdminKey(): string | null {
  return localStorage.getItem(ADMIN_KEY_STORAGE)
}

export function setAdminKey(key: string): void {
  localStorage.setItem(ADMIN_KEY_STORAGE, key)
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : `Request failed with status ${status}`,
    )
    this.name = 'ApiError'
  }
}

export class MissingKeyError extends Error {
  constructor(which: 'client' | 'admin') {
    super(`No ${which} API key is set. Call set${which === 'client' ? 'Client' : 'Admin'}Key() first.`)
    this.name = 'MissingKeyError'
  }
}

type AuthMode = 'none' | 'client' | 'admin' | 'client-or-admin'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  auth?: AuthMode
  // Stream tokens are per-user, per-camera — issued at call time, not a
  // single stored secret like the client/admin keys above.
  streamToken?: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
}

function buildHeaders(auth: AuthMode, streamToken?: string): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (auth === 'client' || auth === 'client-or-admin') {
    const key = getClientKey()
    if (key) headers['X-Client-Key'] = key
    else if (auth === 'client') throw new MissingKeyError('client')
  }
  if (auth === 'admin' || (auth === 'client-or-admin' && !headers['X-Client-Key'])) {
    const key = getAdminKey()
    if (key) headers['X-Admin-Key'] = key
    else if (auth === 'admin') throw new MissingKeyError('admin')
  }
  if (streamToken) headers['X-Stream-Token'] = streamToken
  return headers
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', auth = 'none', streamToken, body, query } = options

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

  const contentType = res.headers.get('content-type') ?? ''
  const parsed = contentType.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    throw new ApiError(res.status, parsed)
  }
  return parsed as T
}
