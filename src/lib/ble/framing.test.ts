import { describe, expect, it } from 'vitest'
import { buildAppFrame, fragmentFrame, FrameAssembler, parseAppFrame } from './framing'
import { FRAGMENT_FLAG } from './constants'

function reassemble(fragments: Uint8Array[]) {
  const assembler = new FrameAssembler()
  let result = null
  for (const fragment of fragments) {
    result = assembler.push(fragment)
  }
  return result
}

describe('buildAppFrame / parseAppFrame', () => {
  it('round-trips a short payload with a correct checksum', () => {
    const payload = new Uint8Array([1, 2, 3])
    const frame = buildAppFrame(0x0501, payload)

    // [cmdHi][cmdLo][len][payload...][checksum]
    expect(frame[0]).toBe(0x05)
    expect(frame[1]).toBe(0x01)
    expect(frame[2]).toBe(3)
    expect(Array.from(frame.slice(3, 6))).toEqual([1, 2, 3])

    let sum = 0
    for (const b of frame.slice(0, -1)) sum = (sum + b) & 0xff
    expect(frame[frame.length - 1]).toBe(sum)

    const parsed = parseAppFrame(frame)
    expect(parsed.cmd).toBe(0x0501)
    expect(Array.from(parsed.data)).toEqual([1, 2, 3])
  })

  it('parses cmd/data correctly regardless of a trailing checksum byte', () => {
    // parseAppFrame reads exactly `len` data bytes, so it doesn't care what
    // trailing byte(s) follow - this is what makes it safe to call on the
    // frame either right after buildAppFrame or after AES round-tripping it.
    const frame = buildAppFrame(0x018e, new Uint8Array([0xaa, 0xbb]))
    const parsed = parseAppFrame(frame)
    expect(parsed.cmd).toBe(0x018e)
    expect(Array.from(parsed.data)).toEqual([0xaa, 0xbb])
  })
})

describe('fragmentFrame / FrameAssembler round-trip', () => {
  it('keeps a small frame as a single fragment', () => {
    const frame = buildAppFrame(0x000c, new Uint8Array(10))
    const fragments = fragmentFrame(frame, false)

    expect(fragments).toHaveLength(1)
    expect(fragments[0][0]).toBe(FRAGMENT_FLAG.SINGLE.plain)

    const assembled = reassemble(fragments)
    expect(assembled).not.toBeNull()
    expect(assembled!.encrypted).toBe(false)
    expect(Array.from(assembled!.raw)).toEqual(Array.from(frame))
  })

  it('marks a single AES frame with the encrypted single flag', () => {
    const frame = new Uint8Array(10).fill(7)
    const fragments = fragmentFrame(frame, true)
    expect(fragments[0][0]).toBe(FRAGMENT_FLAG.SINGLE.aes)

    const assembled = reassemble(fragments)
    expect(assembled!.encrypted).toBe(true)
  })

  it('splits a 97-byte WiFi-sized payload into first/middle/last fragments and reassembles it exactly', () => {
    // The real WiFi payload plus header/checksum overhead lands well past
    // the 16-byte-per-fragment limit - this is the shape that exercises the
    // multi-fragment path for real.
    const frame = new Uint8Array(101)
    for (let i = 0; i < frame.length; i++) frame[i] = i % 256

    const fragments = fragmentFrame(frame, true)
    // 101 bytes / 16-byte chunks = 7 fragments (6 full + 1 partial)
    expect(fragments).toHaveLength(7)
    expect(fragments[0][0]).toBe(FRAGMENT_FLAG.FIRST.aes)
    for (let i = 1; i < fragments.length - 1; i++) {
      expect(fragments[i][0]).toBe(FRAGMENT_FLAG.MIDDLE.aes)
    }
    expect(fragments.at(-1)![0]).toBe(FRAGMENT_FLAG.LAST.aes)

    // Every fragment fits the 20-byte ATT payload limit (4-byte header + up to 16 payload bytes).
    for (const fragment of fragments) {
      expect(fragment.length).toBeLessThanOrEqual(20)
    }

    const assembled = reassemble(fragments)
    expect(assembled!.encrypted).toBe(true)
    expect(Array.from(assembled!.raw)).toEqual(Array.from(frame))
  })

  it('resets its internal buffer after completing a frame, ready for the next one', () => {
    const assembler = new FrameAssembler()
    const first = buildAppFrame(0x0103, new Uint8Array(8))
    const second = buildAppFrame(0x0581, new Uint8Array(1))

    for (const fragment of fragmentFrame(first, true)) assembler.push(fragment)

    let secondResult = null
    for (const fragment of fragmentFrame(second, true)) {
      secondResult = assembler.push(fragment)
    }

    expect(Array.from(secondResult!.raw)).toEqual(Array.from(second))
  })
})
