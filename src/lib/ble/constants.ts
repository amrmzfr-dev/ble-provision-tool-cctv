// Recovered from bluetoothhelper-release.aar (com.opensdk.bluetoothhelper.DHBluetoothDefine).
// See C:\Users\ASUS\.claude\plans\vectorized-rolling-cascade.md for the full protocol writeup.

export const GATT_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb'
export const GATT_WRITE_CHARACTERISTIC_UUID = '0000fff1-0000-1000-8000-00805f9b34fb'
export const GATT_NOTIFY_CHARACTERISTIC_UUID = '0000fff2-0000-1000-8000-00805f9b34fb'

// 0x4844 little-endian on the wire = ASCII "DH" (Dahua).
export const DAHUA_MANUFACTURER_ID = 0x4844

// Command codes: [request, response] pairs, as (cmdHi << 8 | cmdLo).
export const CMD = {
  PUBLIC_KEY: { tx: 0x000c, rx: 0x008c },
  GET_SN: { tx: 0x010e, rx: 0x018e },
  GET_SECURITY_CODE: { tx: 0x0505, rx: 0x0585 },
  SET_TIME: { tx: 0x0103, rx: 0x0183 },
  SET_WIFI: { tx: 0x0501, rx: 0x0581 },
  WIFI_JOIN_RESULT: { rx: 0x0502 },
} as const

// Fragment header flags: [plaintext, aes-encrypted] pairs.
export const FRAGMENT_FLAG = {
  SINGLE: { plain: 0xdc, aes: 0xdd },
  FIRST: { plain: 0xd4, aes: 0xd5 },
  MIDDLE: { plain: 0xd0, aes: 0xd1 },
  LAST: { plain: 0xd8, aes: 0xd9 },
} as const

export const ATT_MTU_DEFAULT = 23
export const ATT_PAYLOAD_MAX = 20 // MTU (23) minus the 3-byte ATT write-request header
export const FRAGMENT_HEADER_LEN = 4
export const FRAGMENT_PAYLOAD_MAX = ATT_PAYLOAD_MAX - FRAGMENT_HEADER_LEN // 16

export const WIFI_SSID_FIELD_LEN = 32
export const WIFI_PASSWORD_FIELD_LEN = 64
export const WIFI_ENCRYPTION_BYTE = 0x0a

export const WIFI_JOIN_RESULT_TEXT: Record<number, string> = {
  0: 'Connected successfully',
  1: 'Wrong WiFi password',
  2: 'WiFi network (SSID) not found',
  3: 'Unknown error reported by camera',
}
