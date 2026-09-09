import { bytesToHex, logEvent } from '@/lib/debugLog'
import { GATT_NOTIFY_CHARACTERISTIC_UUID, GATT_SERVICE_UUID, GATT_WRITE_CHARACTERISTIC_UUID } from './constants'
import { fragmentFrame, FrameAssembler, type AssembledFrame } from './framing'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Thin GATT wrapper. Deliberately protocol-ignorant — it just moves bytes
 * over fff1 (write) and fff2 (notify), fragmenting/reassembling per the
 * wire format, and hands complete frames back to whoever's waiting.
 * Encryption, command codes, and response validation all live in
 * provision.ts, which knows the actual protocol semantics.
 */
export class BleTransport {
  private device: BluetoothDevice
  private server: BluetoothRemoteGATTServer | null = null
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null
  private notifyChar: BluetoothRemoteGATTCharacteristic | null = null
  private assembler = new FrameAssembler()
  private pending: { resolve: (f: AssembledFrame) => void; reject: (e: Error) => void } | null = null

  constructor(device: BluetoothDevice) {
    this.device = device
  }

  async connect(): Promise<void> {
    if (!this.device.gatt) throw new Error('This device has no GATT server')

    this.device.addEventListener('gattserverdisconnected', this.handleDisconnect)

    logEvent('info', 'Connecting to GATT server…')
    const server = await this.device.gatt.connect()
    const service = await server.getPrimaryService(GATT_SERVICE_UUID)
    this.writeChar = await service.getCharacteristic(GATT_WRITE_CHARACTERISTIC_UUID)
    this.notifyChar = await service.getCharacteristic(GATT_NOTIFY_CHARACTERISTIC_UUID)

    // startNotifications() resolving already confirms the CCCD (0x2902)
    // descriptor write completed — no separate wait needed before the
    // handshake's first write.
    await this.notifyChar.startNotifications()
    this.notifyChar.addEventListener('characteristicvaluechanged', this.handleNotification)
    logEvent('success', 'GATT connected, notifications enabled on fff2')

    this.server = server
  }

  disconnect(): void {
    logEvent('info', 'Disconnecting BLE transport')
    this.notifyChar?.removeEventListener('characteristicvaluechanged', this.handleNotification)
    this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect)
    this.server?.disconnect()
  }

  private handleDisconnect = () => {
    logEvent('error', 'Camera disconnected over Bluetooth' + (this.pending ? ' (mid-request)' : ''))
    this.pending?.reject(new Error('The camera disconnected over Bluetooth mid-request'))
    this.pending = null
  }

  private handleNotification = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic
    const value = target.value
    if (!value) return

    const fragment = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    logEvent('rx', `fragment (${fragment.length}B) flag=0x${fragment[0]?.toString(16)}: ${bytesToHex(fragment)}`)

    const assembled = this.assembler.push(fragment)
    if (assembled) {
      logEvent(
        'rx',
        `frame complete (${assembled.raw.length}B, ${assembled.encrypted ? 'encrypted' : 'plaintext'}): ${bytesToHex(assembled.raw)}`,
      )
      if (this.pending) {
        const { resolve } = this.pending
        this.pending = null
        resolve(assembled)
      } else {
        logEvent('info', 'Frame arrived with nothing waiting for it — dropped')
      }
    }
  }

  private async writeFragments(fragments: Uint8Array[]): Promise<void> {
    if (!this.writeChar) throw new Error('Not connected')
    for (const fragment of fragments) {
      logEvent('tx', `fragment (${fragment.length}B) flag=0x${fragment[0]?.toString(16)}: ${bytesToHex(fragment)}`)
      // Confirmed against real hardware: fff1 only accepts write-without-
      // response (write-with-response threw "GATT operation not permitted").
      // Makes sense in hindsight — the protocol already has its own
      // application-level acks (00 8C, 01 8E, ...), so it doesn't need the
      // ATT layer's too. writeValueWithoutResponse()'s promise resolves once
      // the write is locally queued, not once the peripheral's received it,
      // so a small pacing delay between fragments avoids outrunning
      // whatever buffer the camera's BLE stack has for a multi-fragment
      // message (the 97-byte WiFi payload is 7 fragments back to back).
      //
      // TS 5.7+'s stricter typed-array generics mean a plain Uint8Array no
      // longer satisfies BufferSource without help — safe here since this
      // is always backed by a real, non-shared ArrayBuffer at runtime.
      await this.writeChar.writeValueWithoutResponse(fragment as BufferSource)
      await sleep(15)
    }
  }

  private waitForFrame(timeoutMs: number, onTimeoutMessage: string): Promise<AssembledFrame> {
    if (this.pending) throw new Error('A BLE request is already in flight')

    return new Promise<AssembledFrame>((resolve, reject) => {
      this.pending = { resolve, reject }
      setTimeout(() => {
        if (this.pending) {
          this.pending = null
          logEvent('error', `Timeout after ${timeoutMs}ms: ${onTimeoutMessage}`)
          reject(new Error(onTimeoutMessage))
        }
      }, timeoutMs)
    })
  }

  /** Writes `frame` and waits for the next complete response frame — the protocol is strictly one request in flight at a time. */
  async sendRaw(frame: Uint8Array, encrypted: boolean, timeoutMs = 10_000): Promise<AssembledFrame> {
    const wait = this.waitForFrame(timeoutMs, 'Timed out waiting for a response from the camera')
    await this.writeFragments(fragmentFrame(frame, encrypted))
    return wait
  }

  /** For responses that arrive unsolicited (the WiFi join result), not as a direct reply to a write. */
  async waitForNotification(timeoutMs: number): Promise<AssembledFrame> {
    logEvent('info', `Waiting up to ${timeoutMs}ms for an unsolicited notification…`)
    return this.waitForFrame(timeoutMs, 'Timed out waiting for the camera to report its WiFi join result')
  }
}
