import { dashboardFetch } from './dashboardConfig'

export interface DashboardAllCamera {
  serial: string
  ip: string | null
  status: string | null
  connected: boolean
  registrationTime: string | null
  picName: string | null
}

export function listDashboardAllCameras(): Promise<DashboardAllCamera[]> {
  return dashboardFetch('/dashboard/all-cameras')
}
