import { describe, expect, it } from 'vitest'
import { buildTimePayload, buildWifiPayload, parseSnOrScResponse } from './payloads'

describe('buildWifiPayload', () => {
  it('is exactly 97 bytes: 32-byte SSID + 64-byte password + 1 encryption byte', () => {
    const payload = buildWifiPayload('MyWifi', 'hunter2')
    expect(payload.length).toBe(97)
  })

  it('zero-pads short SSID/password fields rather than leaving garbage', () => {
    const payload = buildWifiPayload('AB', 'C')
    const ssidField = payload.slice(0, 32)
    const passwordField = payload.slice(32, 96)

    expect(Array.from(ssidField.slice(0, 2))).toEqual([0x41, 0x42]) // "AB"
    expect(Array.from(ssidField.slice(2))).toEqual(new Array(30).fill(0))
    expect(passwordField[0]).toBe(0x43) // "C"
    expect(Array.from(passwordField.slice(1))).toEqual(new Array(63).fill(0))
  })

  it('sets the trailing encryption byte to 0x0a', () => {
    const payload = buildWifiPayload('x', 'y')
    expect(payload[96]).toBe(0x0a)
  })

  it('rejects a SSID or password that overflows its field', () => {
    expect(() => buildWifiPayload('a'.repeat(33), 'pw')).toThrow(/32-byte field/)
    expect(() => buildWifiPayload('ssid', 'a'.repeat(65))).toThrow(/64-byte field/)
  })
})

describe('buildTimePayload', () => {
  it('produces an 8-byte big-endian value', () => {
    const payload = buildTimePayload(new Date('2026-01-01T00:00:00Z'))
    expect(payload.length).toBe(8)
  })

  it('encodes local-time-shifted seconds, not raw UTC seconds', () => {
    // Independently recomputes the same shift buildTimePayload should apply,
    // using the test runner's own getTimezoneOffset() - this passes
    // regardless of what timezone the machine running it is in, since both
    // sides use the same formula rather than assuming a fixed offset.
    const date = new Date('2026-01-01T00:00:00Z')
    const payload = buildTimePayload(date)
    const view = new DataView(payload.buffer)
    const encodedSeconds = view.getBigInt64(0, false)

    const expectedSeconds =
      (BigInt(date.getTime()) - BigInt(date.getTimezoneOffset()) * 60_000n) / 1000n
    expect(encodedSeconds).toBe(expectedSeconds)
  })
})

describe('parseSnOrScResponse', () => {
  it('hex-decodes a double-encoded ASCII-hex response', () => {
    // "AB12" as ASCII-hex-of-ASCII: each character of "AB12" hex-encoded is
    // "41423132" - the wire bytes are the ASCII characters of that hex
    // string, which this function should decode back to "AB12".
    const hexOfHex = '41423132'
    const wireBytes = new TextEncoder().encode(hexOfHex)
    expect(parseSnOrScResponse(wireBytes)).toBe('AB12')
  })

  it('falls back to direct ASCII if the bytes are not valid hex text', () => {
    const wireBytes = new TextEncoder().encode('BL08809RAG33B84')
    expect(parseSnOrScResponse(wireBytes)).toBe('BL08809RAG33B84')
  })
})
