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
