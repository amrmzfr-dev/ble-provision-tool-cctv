import { dashboardFetch } from './dashboardConfig'

export interface DashboardCharger {
  serial: string
  ip: string | null
  status: string | null
  connected: boolean
  registrationTime: string | null
  picName: string | null
}

export function listDashboardChargers(): Promise<DashboardCharger[]> {
  return dashboardFetch('/dashboard/chargers')
}
