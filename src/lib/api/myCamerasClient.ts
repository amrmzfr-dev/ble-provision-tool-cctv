// This app's own "My Cameras" revisit list — backed by BleProvisionApi's
// Postgres, not the real camera backend. See backend/Controllers/MyCamerasController.cs.
import { apiFetch } from './config'

export interface CameraDto {
  serial: string
  label: string | null
  lastStatus: string | null
  lastStatusAt: string | null
  addedAt: string
}

export function listMyCameras(): Promise<CameraDto[]> {
  return apiFetch('/mycameras')
}

export function upsertMyCamera(serial: string, label?: string): Promise<CameraDto> {
  return apiFetch('/mycameras', { method: 'POST', body: { serial, label } })
}

export function updateMyCameraStatus(serial: string, status: string): Promise<void> {
  return apiFetch(`/mycameras/${serial}/status`, { method: 'PUT', body: status })
}

/** One request refreshes every camera in the list — the backend fetches the real backend's bulk /admin/cameras once and filters it down, instead of one status call per row. */
export function refreshAllMyCameras(): Promise<CameraDto[]> {
  return apiFetch('/mycameras/refresh', { method: 'POST' })
}

export function removeMyCamera(serial: string): Promise<void> {
  return apiFetch(`/mycameras/${serial}`, { method: 'DELETE' })
}
