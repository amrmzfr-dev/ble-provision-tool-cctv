import {
  WIFI_ENCRYPTION_BYTE,
  WIFI_PASSWORD_FIELD_LEN,
  WIFI_SSID_FIELD_LEN,
} from './constants'

function utf8ZeroPadded(text: string, fieldLen: number): Uint8Array {
  const encoded = new TextEncoder().encode(text)
  if (encoded.length > fieldLen) {
    throw new Error(`"${text}" is ${encoded.length} bytes UTF-8, longer than the ${fieldLen}-byte field`)
  }
  const out = new Uint8Array(fieldLen)
  out.set(encoded)
  return out
}

/** ssid(32) + password(64) + encryption(1) = 97 bytes (0x61), matching the decompiled SDK's postWIFIConfigPacket. */
export function buildWifiPayload(ssid: string, password: string): Uint8Array {
  const out = new Uint8Array(WIFI_SSID_FIELD_LEN + WIFI_PASSWORD_FIELD_LEN + 1)
  out.set(utf8ZeroPadded(ssid, WIFI_SSID_FIELD_LEN), 0)
  out.set(utf8ZeroPadded(password, WIFI_PASSWORD_FIELD_LEN), WIFI_SSID_FIELD_LEN)
  out[WIFI_SSID_FIELD_LEN + WIFI_PASSWORD_FIELD_LEN] = WIFI_ENCRYPTION_BYTE
  return out
}

/** Big-endian int64 seconds, local time shifted by the timezone offset - matches postUTCTimePacket. */
export function buildTimePayload(date: Date): Uint8Array {
  const localMillis = BigInt(date.getTime())
  const tzOffsetMillis = BigInt(-date.getTimezoneOffset() * 60_000)
  const seconds = (localMillis + tzOffsetMillis) / 1000n

  const out = new Uint8Array(8)
  const view = new DataView(out.buffer)
  view.setBigInt64(0, seconds, false)
  return out
}

/**
 * UNCONFIRMED against real hardware. The decompiled SDK note says the SN/SC
 * response "arrives as an ASCII string encoded as hex" - read two ways:
 * (a) the wire bytes are themselves plain ASCII (the serial's characters
 *     directly), or (b) the wire bytes are ASCII hex digits that need one
 *     more hex-decode to reach the real string.
 * This tries (b) first since that's the more literal reading of the note,
 * falling back to (a) if the bytes aren't valid hex - so it self-corrects
 * once tested against a real camera either way.
 */
export function parseSnOrScResponse(data: Uint8Array): string {
  const asAscii = new TextDecoder().decode(data)
  const looksLikeHex = /^[0-9a-fA-F]+$/.test(asAscii) && asAscii.length % 2 === 0
  if (looksLikeHex) {
    const bytes = new Uint8Array(asAscii.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(asAscii.slice(i * 2, i * 2 + 2), 16)
    }
    return new TextDecoder().decode(bytes)
  }
  return asAscii
}
