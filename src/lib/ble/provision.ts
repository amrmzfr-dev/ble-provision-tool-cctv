import { bytesToHex, logEvent } from '@/lib/debugLog'
import { CMD, WIFI_JOIN_RESULT_TEXT } from './constants'
import { aesCbcDecrypt, aesCbcEncrypt, deriveSessionKey, generateRsaKeypair, type SessionKey } from './crypto'
import { buildAppFrame, parseAppFrame } from './framing'
import { buildTimePayload, buildWifiPayload, parseSnOrScResponse } from './payloads'
import { BleTransport } from './transport'

export type ProvisionStage =
  | 'connecting'
  | 'exchanging-key'
  | 'reading-serial'
  | 'reading-security-code'
  | 'syncing-time'
  | 'sending-wifi'
  | 'waiting-for-join'
  | 'done'

export const PROVISION_STAGE_LABEL: Record<ProvisionStage, string> = {
  connecting: 'Connecting over Bluetooth…',
  'exchanging-key': 'Exchanging encryption keys…',
  'reading-serial': 'Reading serial number…',
  'reading-security-code': 'Reading security code…',
  'syncing-time': 'Syncing camera clock…',
  'sending-wifi': 'Sending WiFi credentials…',
  'waiting-for-join': 'Waiting for the camera to join WiFi…',
  done: 'Done',
}

export interface ProvisionResult {
  serialNumber: string
  securityCode: string
  /** 0 = success, 1 = wrong password, 2 = SSID not found, 3 = unknown error */
  joinResultCode: number
  joinResultText: string
}

interface CommandPair {
  tx: number
  rx: number
}

function stage(onStage: (stage: ProvisionStage) => void, s: ProvisionStage): void {
  logEvent('info', `— ${PROVISION_STAGE_LABEL[s]} —`)
  onStage(s)
}

export async function runProvisioning(
  device: BluetoothDevice,
  ssid: string,
  password: string,
  onStage: (stage: ProvisionStage) => void,
  /**
   * Fired right after the camera acks the WiFi credentials (05 81), before
   * waiting for the join result — deliberately NOT after join success.
   * Calling the backend's wifi-configured notification this early, rather
   * than after confirming the join over BLE, sidesteps a real backend race:
   * that endpoint writes ip=None/port=None for this device on every call,
   * and the write only corrupts anything if the camera has *already*
   * connected with real values by the time it lands. Notifying immediately
   * (matching what the original app almost certainly does) keeps the
   * harmless ordering — null-write first, camera's real registration
   * overwrites it after — instead of reversing it. See README.md's
   * "wifi-configured timing" section for the full incident writeup. Errors
   * here are logged, never thrown — a failed notification must not abort an
   * otherwise-successful BLE handshake.
   */
  onWifiSent: () => void,
): Promise<ProvisionResult> {
  const transport = new BleTransport(device)

  try {
    stage(onStage, 'connecting')
    await transport.connect()

    stage(onStage, 'exchanging-key')
    const keypair = generateRsaKeypair()
    logEvent('info', `Sending our RSA public key (${keypair.modulus.length}B modulus)`)
    const pubKeyResponse = await transport.sendRaw(buildAppFrame(CMD.PUBLIC_KEY.tx, keypair.modulus), false)
    const pubKeyParsed = parseAppFrame(pubKeyResponse.raw)
    expectCmd(CMD.PUBLIC_KEY, pubKeyParsed.cmd)
    const secret = keypair.decrypt(pubKeyParsed.data)
    logEvent('info', `Decrypted secret (${secret.length}B): ${bytesToHex(secret)}`)
    const session = deriveSessionKey(secret)
    logEvent('success', `Session key derived (key ${session.key.length}B, iv ${session.iv.length}B)`)

    const sendEncrypted = (label: string, cmd: CommandPair, payload: Uint8Array) =>
      sendEncryptedCommand(transport, session, label, cmd, payload)

    stage(onStage, 'reading-serial')
    const snData = await sendEncrypted('GET_SN', CMD.GET_SN, new Uint8Array(0))
    const serialNumber = parseSnOrScResponse(snData)
    logEvent('success', `Serial number: ${serialNumber} (raw: ${bytesToHex(snData)})`)

    stage(onStage, 'reading-security-code')
    const scData = await sendEncrypted('GET_SECURITY_CODE', CMD.GET_SECURITY_CODE, new Uint8Array(0))
    const securityCode = parseSnOrScResponse(scData)
    logEvent('success', `Security code: ${securityCode} (raw: ${bytesToHex(scData)})`)

    stage(onStage, 'syncing-time')
    await sendEncrypted('SET_TIME', CMD.SET_TIME, buildTimePayload(new Date()))

    stage(onStage, 'sending-wifi')
    logEvent('info', `SSID "${ssid}", password length ${password.length}`)
    await sendEncrypted('SET_WIFI', CMD.SET_WIFI, buildWifiPayload(ssid, password))

    try {
      onWifiSent()
    } catch (err) {
      logEvent('error', `onWifiSent callback threw: ${err instanceof Error ? err.message : String(err)}`)
    }

    stage(onStage, 'waiting-for-join')
    const joinFrame = await transport.waitForNotification(30_000)
    const decryptedJoin = await aesCbcDecrypt(joinFrame.raw, session)
    const joinParsed = parseAppFrame(decryptedJoin)
    if (joinParsed.cmd !== CMD.WIFI_JOIN_RESULT.rx) {
      logEvent(
        'error',
        `Expected join-result cmd 0x${CMD.WIFI_JOIN_RESULT.rx.toString(16)}, got 0x${joinParsed.cmd.toString(16)} instead: ${bytesToHex(joinParsed.data)}`,
      )
      throw new Error(
        `Expected the WiFi join result (0x${CMD.WIFI_JOIN_RESULT.rx.toString(16)}), got 0x${joinParsed.cmd.toString(16)}`,
      )
    }
    const joinResultCode = joinParsed.data[0]
    const joinResultText = WIFI_JOIN_RESULT_TEXT[joinResultCode] ?? `Unrecognized result code ${joinResultCode}`
    logEvent(joinResultCode === 0 ? 'success' : 'error', `Join result: ${joinResultCode} (${joinResultText})`)

    stage(onStage, 'done')
    return { serialNumber, securityCode, joinResultCode, joinResultText }
  } catch (err) {
    logEvent('error', `Provisioning failed: ${err instanceof Error ? err.message : String(err)}`)
    throw err
  } finally {
    transport.disconnect()
  }
}

async function sendEncryptedCommand(
  transport: BleTransport,
  session: SessionKey,
  label: string,
  cmd: CommandPair,
  payload: Uint8Array,
): Promise<Uint8Array> {
  const frame = buildAppFrame(cmd.tx, payload)
  const encryptedFrame = await aesCbcEncrypt(frame, session)
  logEvent('tx', `${label} (0x${cmd.tx.toString(16)}), ${payload.length}B payload`)
  const response = await transport.sendRaw(encryptedFrame, true)
  const decrypted = await aesCbcDecrypt(response.raw, session)
  const parsed = parseAppFrame(decrypted)
  expectCmd(cmd, parsed.cmd)
  logEvent('rx', `${label} ack (0x${parsed.cmd.toString(16)}): ${bytesToHex(parsed.data)}`)
  return parsed.data
}

function expectCmd(cmd: CommandPair, actual: number): void {
  if (actual !== cmd.rx) {
    throw new Error(`Expected response 0x${cmd.rx.toString(16)}, got 0x${actual.toString(16)}`)
  }
}
