// Full typed surface for cctv-api-prod - see API_REFERENCE.md for the source
// docs/line-numbers behind each of these. Only getDeviceStatus and
// postWifiConfigured are wired into this app's UI today (Phase 5); the rest
// is here because the full backend API was asked for, ready for whenever a
// later phase needs it.
import { apiFetch } from './config'
import type {
  AdminCameraEntry,
  AdminLoginRequest,
  AdminLoginResponse,
  AdminUser,
  DeviceListEntry,
  DeviceRequestStatusOwner,
  DeviceRequestStatusUser,
  DeviceResetRequest,
  DeviceRestartRequest,
  DeviceStatus,
  RegisterCredentialsApproved,
  RegisterCredentialsPending,
  RegisterCredentialsRequest,
  SetWifiRequest,
  StreamTokenRequest,
  StreamTokenResponse,
  WifiConfiguredRequest,
  WifiConfiguredResponse,
  WifiInterface,
} from './types'

// ---- Device Registration & Owner Approval (public) ----

export function registerCredentials(
  req: RegisterCredentialsRequest,
): Promise<RegisterCredentialsApproved | RegisterCredentialsPending> {
  return apiFetch('/device/register_credentials', { method: 'POST', body: req })
}

// Note the asymmetry: this is keyed by serial, but approve/reject below are
// keyed by request_id - that's the actual backend shape, not a typo.
export function getDeviceRequestStatus(
  serial: string,
  userId: string,
): Promise<DeviceRequestStatusOwner | DeviceRequestStatusUser> {
  return apiFetch(`/device/${serial}/request/status`, { query: { user_id: userId } })
}

export function approveDeviceRequest(requestId: string, userId: string): Promise<{ success: true }> {
  return apiFetch(`/device/request/${requestId}/approve`, { method: 'POST', body: { user_id: userId } })
}

export function rejectDeviceRequest(requestId: string, userId: string): Promise<{ success: true }> {
  return apiFetch(`/device/request/${requestId}/reject`, { method: 'POST', body: { user_id: userId } })
}

// ---- Device Info & Status ----

export function listDevices(): Promise<DeviceListEntry[]> {
  return apiFetch('/devices')
}

export function getDeviceStatus(serial: string): Promise<DeviceStatus> {
  return apiFetch(`/device/${serial}/status`)
}

export function reconnectDevice(serial: string): Promise<{ success: true }> {
  return apiFetch(`/device/${serial}/reconnect`, { method: 'POST' })
}

export function getLicenseInfo(): Promise<Record<string, unknown>> {
  return apiFetch('/license-info')
}

// ---- Provisioning - used by this app ----

export function postWifiConfigured(
  serial: string,
  req: WifiConfiguredRequest = {},
): Promise<WifiConfiguredResponse> {
  return apiFetch(`/device/${serial}/provisioning/wifi-configured`, {
    method: 'POST',
    body: req,
  })
}

// ---- Device Control - ⚠️ no auth enforced server-side, see API_REFERENCE.md ----

export function resetDevice(serial: string, req: DeviceResetRequest = { confirm: true }): Promise<{ success: true }> {
  return apiFetch(`/device/${serial}/reset`, { method: 'POST', body: req })
}

export function restartDevice(serial: string, req: DeviceRestartRequest = { confirm: true }): Promise<{ success: true }> {
  return apiFetch(`/device/${serial}/restart`, { method: 'POST', body: req })
}

export function removeDeviceUser(serial: string, userId: string, streamToken: string): Promise<{ success: true }> {
  return apiFetch(`/device/${serial}/user/${userId}`, { method: 'DELETE', streamToken })
}

// ---- Storage & Recordings (stream-token gated) ----

export function getDeviceStorage(serial: string, streamToken: string): Promise<Record<string, unknown>> {
  return apiFetch(`/device/${serial}/storage`, { streamToken })
}

export function formatDeviceStorage(
  serial: string,
  streamToken: string,
  options: { storage_device?: string; file_system?: string } = {},
): Promise<{ success: true }> {
  return apiFetch(`/device/${serial}/storage/format`, {
    method: 'POST',
    streamToken,
    body: { ...options, confirm: true },
  })
}

export function getDeviceRecordings(
  serial: string,
  streamToken: string,
  query: { channel?: number; start_time: string; end_time: string; type?: string },
): Promise<Record<string, unknown>> {
  return apiFetch(`/device/${serial}/recordings`, { streamToken, query })
}

/** Returns a URL to hit directly (binary video stream) rather than a parsed response. */
export function getDevicePlaybackUrl(serial: string): string {
  return `/api/device/${serial}/playback`
}

// ---- WiFi Config - ⚠️ no auth enforced server-side, see API_REFERENCE.md ----

export function getDeviceWifi(serial: string): Promise<WifiInterface[]> {
  return apiFetch(`/device/${serial}/wifi`)
}

export function setDeviceWifi(serial: string, req: SetWifiRequest): Promise<{ success: true }> {
  return apiFetch(`/device/${serial}/wifi`, { method: 'POST', body: req })
}

// ---- Streaming ----

/** Returns a URL to hit directly (binary FLV/TS stream) rather than a parsed response. */
export function getStreamUrl(
  streamId: string,
  query: { format?: string; channel?: number; stream_type?: number; device_id?: string; token: string },
): string {
  const params = new URLSearchParams(
    Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  )
  return `/api/stream/${streamId}?${params.toString()}`
}

export function getStreamDiagnostics(streamId: string, streamToken: string): Promise<Record<string, unknown>> {
  return apiFetch(`/stream/${streamId}/diagnostics`, { streamToken })
}

export function stopStream(streamId: string, streamToken: string): Promise<{ success: true }> {
  return apiFetch(`/stream/${streamId}/stop`, { method: 'POST', streamToken })
}

export function requestStreamToken(req: StreamTokenRequest): Promise<StreamTokenResponse> {
  return apiFetch('/stream/token', { method: 'POST', body: req })
}

// ---- Client Token Management ----

export function listTokens(filter: { user_id?: string; device_serial?: string }): Promise<StreamTokenResponse[]> {
  return apiFetch('/tokens', { query: filter })
}

export function getUserTokens(userId: string): Promise<StreamTokenResponse[]> {
  return apiFetch(`/tokens/${userId}`)
}

export function regenerateToken(userId: string): Promise<StreamTokenResponse> {
  return apiFetch(`/tokens/${userId}/regenerate`, { method: 'POST' })
}

export function revokeToken(token: string): Promise<{ success: true }> {
  return apiFetch(`/tokens/${token}/revoke`, { method: 'POST' })
}

// ---- Admin - Auth ----

/** Returns the raw admin API key in the response - treat as sensitive, never log it. */
export function adminLogin(req: AdminLoginRequest): Promise<AdminLoginResponse> {
  return apiFetch('/admin/auth/login', { method: 'POST', body: req })
}

export function adminLogout(): Promise<{ success: true }> {
  return apiFetch('/admin/auth/logout', { method: 'POST' })
}

// ---- Admin - Users CRUD ----

export function adminListUsers(): Promise<AdminUser[]> {
  return apiFetch('/admin/users')
}

export function adminCreateUser(req: { username: string; password: string; role: 'admin' | 'operator' }): Promise<AdminUser> {
  return apiFetch('/admin/users', { method: 'POST', body: req })
}

export function adminUpdateUser(
  username: string,
  req: Partial<{ password: string; role: 'admin' | 'operator'; is_active: boolean }>,
): Promise<AdminUser> {
  return apiFetch(`/admin/users/${username}`, { method: 'PUT', body: req })
}

export function adminDeleteUser(username: string): Promise<{ success: true }> {
  return apiFetch(`/admin/users/${username}`, { method: 'DELETE' })
}

// ---- Admin - Device Management ----

/**
 * Only actually works while the camera is currently connected - the SDK
 * reset command routes through the backend's live session for this device
 * (registered_devices[serial].ip/port), not a fresh connection made on
 * demand. Confirmed via api_server_listen_mode.py: no ip/port (or no
 * loginID) means this fails with device_info_incomplete /
 * device_not_connected regardless of factory_reset/confirm.
 */
export function adminResetDevice(serial: string, factoryReset = true): Promise<{ success: true }> {
  return apiFetch(`/admin/device/${serial}/reset`, {
    method: 'POST',
    body: { factory_reset: factoryReset, confirm: true },
  })
}

export function adminSyncDeviceTime(serial: string): Promise<{ success: true }> {
  return apiFetch(`/admin/device/${serial}/sync-time`, { method: 'POST' })
}

export function adminGetDevice(serial: string): Promise<AdminCameraEntry> {
  return apiFetch(`/admin/device/${serial}`)
}

export function adminGetDeviceStorage(serial: string): Promise<Record<string, unknown>> {
  return apiFetch(`/admin/device/${serial}/storage`)
}

export function adminGetDeviceRecordings(
  serial: string,
  query: { channel?: number; start_time: string; end_time: string; type?: string },
): Promise<Record<string, unknown>> {
  return apiFetch(`/admin/device/${serial}/recordings`, { query })
}

export function adminGetDevicePlaybackUrl(serial: string): string {
  return `/api/admin/device/${serial}/playback`
}

export function adminListCameras(): Promise<AdminCameraEntry[]> {
  return apiFetch('/admin/cameras')
}

export function adminGetStreamUrl(streamUuid: string): string {
  return `/api/admin/stream/${streamUuid}`
}

// ---- Admin - Tokens & Client Key ----

export function adminListTokens(): Promise<StreamTokenResponse[]> {
  return apiFetch('/admin/tokens')
}

export function adminGetUserTokens(userId: string): Promise<StreamTokenResponse[]> {
  return apiFetch(`/admin/tokens/${userId}`)
}

export function adminGetDeviceTokens(deviceSerial: string): Promise<StreamTokenResponse[]> {
  return apiFetch(`/admin/tokens/device/${deviceSerial}`)
}

export function adminRevokeToken(tokenId: string): Promise<{ success: true }> {
  return apiFetch(`/admin/tokens/${tokenId}/revoke`, { method: 'POST' })
}

export function adminInitializeClientKey(): Promise<{ success: true; client_key: string }> {
  return apiFetch('/admin/client-key/initialize', { method: 'POST' })
}

export function adminGetClientKeyMeta(): Promise<{ created_at: string; last_rotated_at: string | null }> {
  return apiFetch('/admin/client-key')
}

export function adminRotateClientKey(): Promise<{ success: true; client_key: string }> {
  return apiFetch('/admin/client-key/rotate', { method: 'POST' })
}
