import { FRAGMENT_FLAG, FRAGMENT_HEADER_LEN, FRAGMENT_PAYLOAD_MAX } from './constants'

/** [cmdHi][cmdLo][dataLen][payload...][checksum] — checksum is added to every frame, plaintext or not (encryption, when it happens, wraps this whole thing). */
export function buildAppFrame(cmd: number, payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(3 + payload.length)
  frame[0] = (cmd >> 8) & 0xff
  frame[1] = cmd & 0xff
  frame[2] = payload.length
  frame.set(payload, 3)
  return appendChecksum(frame)
}

function appendChecksum(frame: Uint8Array): Uint8Array {
  let sum = 0
  for (const b of frame) sum = (sum + b) & 0xff
  const out = new Uint8Array(frame.length + 1)
  out.set(frame)
  out[frame.length] = sum
  return out
}

export interface ParsedFrame {
  cmd: number
  data: Uint8Array
}

/** Parses an already-decrypted (or originally-plaintext) inner frame. Reads exactly `len` data bytes per the frame's own length field, so it doesn't need to know or care about the trailing checksum byte. */
export function parseAppFrame(buf: Uint8Array): ParsedFrame {
  const cmd = (buf[0] << 8) | buf[1]
  const len = buf[2]
  return { cmd, data: buf.slice(3, 3 + len) }
}

function buildFragment(flag: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(FRAGMENT_HEADER_LEN + payload.length)
  out[0] = flag
  out[1] = 0x40
  out[2] = 0x00
  out[3] = payload.length
  out.set(payload, FRAGMENT_HEADER_LEN)
  return out
}

/** Splits a complete frame (post-checksum, post-encryption-if-any) into ≤20-byte ATT writes. */
export function fragmentFrame(frame: Uint8Array, encrypted: boolean): Uint8Array[] {
  if (frame.length <= FRAGMENT_PAYLOAD_MAX) {
    return [buildFragment(encrypted ? FRAGMENT_FLAG.SINGLE.aes : FRAGMENT_FLAG.SINGLE.plain, frame)]
  }

  const chunks: Uint8Array[] = []
  let offset = 0
  while (offset < frame.length) {
    const chunkLen = Math.min(FRAGMENT_PAYLOAD_MAX, frame.length - offset)
    const isFirst = offset === 0
    const isLast = offset + chunkLen >= frame.length
    const flag = isLast
      ? encrypted
        ? FRAGMENT_FLAG.LAST.aes
        : FRAGMENT_FLAG.LAST.plain
      : isFirst
        ? encrypted
          ? FRAGMENT_FLAG.FIRST.aes
          : FRAGMENT_FLAG.FIRST.plain
        : encrypted
          ? FRAGMENT_FLAG.MIDDLE.aes
          : FRAGMENT_FLAG.MIDDLE.plain
    chunks.push(buildFragment(flag, frame.slice(offset, offset + chunkLen)))
    offset += chunkLen
  }
  return chunks
}

export interface AssembledFrame {
  /** The complete inner frame bytes — still AES-ciphertext if `encrypted` is true, otherwise ready for parseAppFrame directly. */
  raw: Uint8Array
  encrypted: boolean
}

/** Accumulates incoming GATT notification fragments until a full frame arrives. One instance per in-flight request — the protocol is strictly request/response, so there's never more than one message being reassembled at a time. */
export class FrameAssembler {
  private chunks: number[] = []

  push(fragment: Uint8Array): AssembledFrame | null {
    const flag = fragment[0]
    const chunkLen = fragment[3]
    const payload = fragment.slice(FRAGMENT_HEADER_LEN, FRAGMENT_HEADER_LEN + chunkLen)

    switch (flag) {
      case FRAGMENT_FLAG.SINGLE.plain:
        return { raw: payload, encrypted: false }
      case FRAGMENT_FLAG.SINGLE.aes:
        return { raw: payload, encrypted: true }

      case FRAGMENT_FLAG.FIRST.plain:
      case FRAGMENT_FLAG.FIRST.aes:
        this.chunks = Array.from(payload)
        return null

      case FRAGMENT_FLAG.MIDDLE.plain:
      case FRAGMENT_FLAG.MIDDLE.aes:
        this.chunks.push(...payload)
        return null

      case FRAGMENT_FLAG.LAST.plain: {
        this.chunks.push(...payload)
        const raw = new Uint8Array(this.chunks)
        this.chunks = []
        return { raw, encrypted: false }
      }
      case FRAGMENT_FLAG.LAST.aes: {
        this.chunks.push(...payload)
        const raw = new Uint8Array(this.chunks)
        this.chunks = []
        return { raw, encrypted: true }
      }

      default:
        throw new Error(`Unrecognized BLE fragment flag: 0x${flag.toString(16)}`)
    }
  }
}
