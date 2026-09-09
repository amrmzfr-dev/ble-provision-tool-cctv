// Persists just enough to resume after the tab/app is closed mid-flow. Only
// meaningful past the point where nothing left in the flow depends on a live
// BLE GATT handle (which never survives a reload) - i.e. once the backend,
// not Bluetooth, is the source of truth for what happens next.
const STORAGE_KEY = 'ble-provision-active-session'

export type ResumableStep = 'backend' | 'stream'

export interface SessionState {
  serial: string
  step: ResumableStep
  backendNotified: boolean
}

export function saveSessionState(state: SessionState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function loadSessionState(): SessionState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SessionState>
    if (!parsed.serial || (parsed.step !== 'backend' && parsed.step !== 'stream')) return null
    return { serial: parsed.serial, step: parsed.step, backendNotified: Boolean(parsed.backendNotified) }
  } catch {
    return null
  }
}

export function clearSessionState(): void {
  localStorage.removeItem(STORAGE_KEY)
}
