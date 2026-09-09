// A tiny external store so the debug log survives screen transitions
// (DeviceScanner remounts each step's screen via `key={step}`) and can be
// read from anywhere — the BLE transport/provisioning layers have no React
// context of their own to log through otherwise.

export type LogLevel = 'info' | 'tx' | 'rx' | 'success' | 'error'

export interface LogEntry {
  id: number
  time: string
  level: LogLevel
  message: string
}

let entries: LogEntry[] = []
let nextId = 1
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function logEvent(level: LogLevel, message: string): void {
  const time = new Date().toLocaleTimeString(undefined, {
    hour12: false,
    minute: '2-digit',
    second: '2-digit',
  })
  entries = [...entries, { id: nextId++, time, level, message }]
  // Cap it — a stuck retry loop shouldn't grow this unbounded.
  if (entries.length > 500) entries = entries.slice(-500)
  notify()
}

export function clearLog(): void {
  entries = []
  notify()
}

export function getLogEntries(): LogEntry[] {
  return entries
}

export function subscribeToLog(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
}
