import { dashboardFetch } from './dashboardConfig'

export interface DashboardUser {
  id: number
  username: string
  displayName: string | null
  isAdmin: boolean
  createdAt: string
}

export interface CreateDashboardUserInput {
  username: string
  password: string
  displayName?: string
  isAdmin: boolean
}

/** Partial - only fields present get changed. displayName: '' clears it. */
export interface UpdateDashboardUserInput {
  displayName?: string
  isAdmin?: boolean
  password?: string
}

export function listDashboardUsers(): Promise<DashboardUser[]> {
  return dashboardFetch('/dashboard/users')
}

export function createDashboardUser(input: CreateDashboardUserInput): Promise<DashboardUser> {
  return dashboardFetch('/dashboard/users', { method: 'POST', body: input })
}

export function updateDashboardUser(username: string, input: UpdateDashboardUserInput): Promise<DashboardUser> {
  return dashboardFetch(`/dashboard/users/${encodeURIComponent(username)}`, { method: 'PUT', body: input })
}

export function deleteDashboardUser(username: string): Promise<void> {
  return dashboardFetch(`/dashboard/users/${encodeURIComponent(username)}`, { method: 'DELETE' })
}
