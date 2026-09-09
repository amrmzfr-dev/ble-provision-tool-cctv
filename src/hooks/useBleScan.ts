import { useCallback, useState } from 'react'
import { DAHUA_MANUFACTURER_ID, GATT_SERVICE_UUID } from '@/lib/ble/constants'
import { BleUnavailableError, type DiscoveredDevice, type ScanFilterMode } from '@/lib/ble/types'

interface UseBleScanResult {
  device: DiscoveredDevice | null
  error: string | null
  scanning: boolean
  scan: (mode: ScanFilterMode, namePrefix?: string) => Promise<void>
  reset: () => void
}

function buildRequestOptions(
  mode: ScanFilterMode,
  namePrefix: string | undefined,
): RequestDeviceOptions {
  const optionalServices = [GATT_SERVICE_UUID]

  if (mode === 'all-devices') {
    return { acceptAllDevices: true, optionalServices }
  }

  if (mode === 'name-prefix') {
    if (!namePrefix) {
      throw new Error('Enter the name prefix read off the camera first.')
    }
    return { filters: [{ namePrefix }], optionalServices }
  }

  return {
    filters: [{ manufacturerData: [{ companyIdentifier: DAHUA_MANUFACTURER_ID }] }],
    optionalServices,
  }
}

export function useBleScan(): UseBleScanResult {
  const [device, setDevice] = useState<DiscoveredDevice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const scan = useCallback(async (mode: ScanFilterMode, namePrefix?: string) => {
    setError(null)

    if (!navigator.bluetooth) {
      setError(new BleUnavailableError().message)
      return
    }

    setScanning(true)
    try {
      const options = buildRequestOptions(mode, namePrefix)
      const picked = await navigator.bluetooth.requestDevice(options)
      setDevice({ device: picked, name: picked.name ?? '(no name advertised)', id: picked.id })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError('No matching device was selected, or none was found nearby.')
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setScanning(false)
    }
  }, [])

  const reset = useCallback(() => {
    setDevice(null)
    setError(null)
  }, [])

  return { device, error, scanning, scan, reset }
}
