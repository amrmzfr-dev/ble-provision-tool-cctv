import { dashboardFetch } from './dashboardConfig'

export interface DashboardCamera {
  serial: string
  label: string | null
  lastStatus: string | null
  lastStatusAt: string | null
  addedAt: string
  configuredByUsername: string | null
  lastCheckedByUsername: string | null
}

export function listDashboardCameras(): Promise<DashboardCamera[]> {
  return dashboardFetch('/dashboard/cameras')
}
