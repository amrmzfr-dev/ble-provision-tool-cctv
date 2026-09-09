import { useSyncExternalStore } from 'react'
import { getLogEntries, subscribeToLog, type LogEntry } from '@/lib/debugLog'

export function useDebugLog(): LogEntry[] {
  return useSyncExternalStore(subscribeToLog, getLogEntries)
}
