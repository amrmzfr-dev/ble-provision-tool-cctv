import type { Step } from '@/components/DeviceScanner'

// Persists exactly enough UI position to survive a page refresh -
// deliberately sessionStorage, not localStorage: it needs to disappear the
// moment the tab/app is actually closed (fresh start at the QR scan screen
// next time), while still surviving a plain reload within the same tab.
const STORAGE_KEY = 'ble-provision-active-session'

export interface PairingSessionState {
  step: Step
  serial: string
  backendNotified: boolean
}

export function savePairingState(state: PairingSessionState): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function loadPairingState(): PairingSessionState | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PairingSessionState>
    if (!parsed.step) return null
    return { step: parsed.step, serial: parsed.serial ?? '', backendNotified: Boolean(parsed.backendNotified) }
  } catch {
    return null
  }
}

export function clearPairingState(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
