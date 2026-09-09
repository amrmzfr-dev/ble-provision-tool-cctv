// Calls to this app's OWN mini backend (backend/, BleProvisionApi) for its
// own login — separate from client.ts, which is the typed surface for the
// real camera backend (cctv.czeros.tech) that BleProvisionApi proxies to.
import { apiFetch } from './config'

export interface LoginResponse {
  token: string
  username: string
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return apiFetch('/auth/login', { method: 'POST', auth: false, body: { username, password } })
}

export function createUser(username: string, password: string): Promise<{ success: true }> {
  return apiFetch('/auth/users', { method: 'POST', body: { username, password } })
}
