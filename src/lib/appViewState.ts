// Persists which top-level screen (Pair / Camera list / a specific camera's
// detail page) the user was on, so a refresh lands back there instead of
// always resetting to the Pair tab. sessionStorage, not localStorage - see
// sessionState.ts's comment: closing the tab/app should still start fresh.
const STORAGE_KEY = 'ble-provision-active-view'

export type StoredView =
  | { name: 'pairing' }
  | { name: 'my-cameras' }
  | { name: 'camera-detail'; serial: string }

export function saveViewState(view: StoredView): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(view))
}

export function loadViewState(): StoredView | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredView>
    if (parsed.name === 'pairing' || parsed.name === 'my-cameras') return { name: parsed.name }
    if (parsed.name === 'camera-detail' && typeof (parsed as { serial?: unknown }).serial === 'string') {
      return { name: 'camera-detail', serial: (parsed as { serial: string }).serial }
    }
    return null
  } catch {
    return null
  }
}
