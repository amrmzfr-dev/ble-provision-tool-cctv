export type ScanFilterMode = 'manufacturer' | 'name-prefix' | 'all-devices'

export interface DiscoveredDevice {
  device: BluetoothDevice
  name: string
  id: string
}

export class BleUnavailableError extends Error {
  constructor() {
    super('This browser has no Web Bluetooth support. On iPhone, open this page in the Bluefy app instead of Safari.')
    this.name = 'BleUnavailableError'
  }
}
