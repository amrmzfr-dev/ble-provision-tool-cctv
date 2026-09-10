import { dashboardFetch } from './dashboardConfig'

export interface DashboardCamera {
  serial: string
  label: string | null
  lastStatus: string | null
  lastStatusAt: string | null
  addedAt: string
  configuredByName: string | null
  lastCheckedByName: string | null
}

export function listDashboardCameras(): Promise<DashboardCamera[]> {
  return dashboardFetch('/dashboard/cameras')
}

/** Straight to the real backend - only works while the camera is actively connected. */
export function resetDashboardCamera(serial: string): Promise<{ success: true }> {
  return dashboardFetch(`/dashboard/cameras/${encodeURIComponent(serial)}/reset`, { method: 'POST' })
}
