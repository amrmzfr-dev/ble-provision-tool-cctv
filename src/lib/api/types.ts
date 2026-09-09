// Types for every endpoint in API_REFERENCE.md. Only DeviceStatus /
// WifiConfiguredResponse are actually used by this app today (Phase 5) — the
// rest exist so client.ts has an accurate typed surface ready for later use.

export type DeviceStatusValue =
  | 'registered'
  | 'waiting_for_connection'
  | 'logging_in'
  | 'connected'
  | 'disconnected'
  | 'login_failed'
  | 'password_error'
  | 'serial_mismatch'
  | 'waiting_for_credentials'
  | 'reset'
  | 'offline'
  | 'connection_timeout'
  | 'unknown'

export interface DeviceStatusError {
  message: string
  code: number | null
  time: number | null
  is_retryable: boolean
  requires_credential_update: boolean
}

export interface DeviceStatusRetryInfo {
  attempts: number
  last_attempt: number
  max_retries: number
}

export interface DeviceStatus {
  serial: string
  status: DeviceStatusValue
  status_description: string
  status_updated_at: string | null
  connected: boolean
  ip: string | null
  port: number | null
  channels: number
  stream_url?: string
  raw_device_id?: string
  has_credentials?: boolean
  status_history: unknown[]
  error?: DeviceStatusError | 'connection_timeout'
  retry_info?: DeviceStatusRetryInfo
  note?: string
}

export interface WifiConfiguredRequest {
  user_id?: string
  note?: string
}

export interface WifiConfiguredResponse {
  success: true
  serial: string
  status: 'waiting_for_connection'
  status_description: string
  message: string
}

export interface RegisterCredentialsRequest {
  serial: string
  user_id: string
}

export interface RegisterCredentialsApproved {
  success: true
  token: string
  username: string
  password: string
}

export interface RegisterCredentialsPending {
  request_id: string
  status: 'pending'
}

export interface DeviceRequestStatusOwner {
  pending_requests_count: number
}

export interface DeviceRequestStatusUser {
  request_id: string
  status: 'pending' | 'approved' | 'rejected' | 'no_request'
}

export interface DeviceListEntry {
  ip: string | null
  port: number | null
  status: DeviceStatusValue
  channels: number
  serial: string
  has_credentials: boolean
  connected: boolean
  stream_url?: string
}

export interface DeviceResetRequest {
  factory_reset?: boolean
  confirm: true
}

export interface DeviceRestartRequest {
  confirm: true
}

export interface WifiInterface {
  ssid: string
  enabled: boolean
  connected: boolean
  encryption_mode: string
  key_type: string
  password_set: boolean
}

export interface SetWifiRequest {
  ssid: string
  password: string
  encryption?: string
}

export interface StreamTokenRequest {
  user_id: string
  device_serial: string
  expires_days?: number
}

export interface StreamTokenResponse {
  token: string
  expires_at: string
}

export interface AdminLoginRequest {
  username: string
  password: string
}

export interface AdminLoginResponse {
  success: true
  username: string
  role: 'admin' | 'operator'
  admin_key: string
}

export interface AdminUser {
  username: string
  role: 'admin' | 'operator'
  is_active: boolean
}

export interface AdminCameraEntry extends DeviceListEntry {
  admin_stream_url: string
  model?: string
  firmware_version?: string
  last_seen?: string
}
