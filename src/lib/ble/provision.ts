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

export async function runProvisioning(
  device: BluetoothDevice,
  ssid: string,
  password: string,
  onStage: (stage: ProvisionStage) => void,
): Promise<ProvisionResult> {
  const transport = new BleTransport(device)

  try {
    onStage('connecting')
    await transport.connect()

    onStage('exchanging-key')
    const keypair = generateRsaKeypair()
    const pubKeyResponse = await transport.sendRaw(buildAppFrame(CMD.PUBLIC_KEY.tx, keypair.modulus), false)
    const pubKeyParsed = parseAppFrame(pubKeyResponse.raw)
    expectCmd(CMD.PUBLIC_KEY, pubKeyParsed.cmd)
    const secret = keypair.decrypt(pubKeyParsed.data)
    const session = deriveSessionKey(secret)

    const sendEncrypted = (cmd: CommandPair, payload: Uint8Array) =>
      sendEncryptedCommand(transport, session, cmd, payload)

    onStage('reading-serial')
    const snData = await sendEncrypted(CMD.GET_SN, new Uint8Array(0))
    const serialNumber = parseSnOrScResponse(snData)

    onStage('reading-security-code')
    const scData = await sendEncrypted(CMD.GET_SECURITY_CODE, new Uint8Array(0))
    const securityCode = parseSnOrScResponse(scData)

    onStage('syncing-time')
    await sendEncrypted(CMD.SET_TIME, buildTimePayload(new Date()))

    onStage('sending-wifi')
    await sendEncrypted(CMD.SET_WIFI, buildWifiPayload(ssid, password))

    onStage('waiting-for-join')
    const joinFrame = await transport.waitForNotification(30_000)
    const decryptedJoin = await aesCbcDecrypt(joinFrame.raw, session)
    const joinParsed = parseAppFrame(decryptedJoin)
    if (joinParsed.cmd !== CMD.WIFI_JOIN_RESULT.rx) {
      throw new Error(
        `Expected the WiFi join result (0x${CMD.WIFI_JOIN_RESULT.rx.toString(16)}), got 0x${joinParsed.cmd.toString(16)}`,
      )
    }
    const joinResultCode = joinParsed.data[0]

    onStage('done')
    return {
      serialNumber,
      securityCode,
      joinResultCode,
      joinResultText: WIFI_JOIN_RESULT_TEXT[joinResultCode] ?? `Unrecognized result code ${joinResultCode}`,
    }
  } finally {
    transport.disconnect()
  }
}

async function sendEncryptedCommand(
  transport: BleTransport,
  session: SessionKey,
  cmd: CommandPair,
  payload: Uint8Array,
): Promise<Uint8Array> {
  const frame = buildAppFrame(cmd.tx, payload)
  const encryptedFrame = await aesCbcEncrypt(frame, session)
  const response = await transport.sendRaw(encryptedFrame, true)
  const decrypted = await aesCbcDecrypt(response.raw, session)
  const parsed = parseAppFrame(decrypted)
  expectCmd(cmd, parsed.cmd)
  return parsed.data
}

function expectCmd(cmd: CommandPair, actual: number): void {
  if (actual !== cmd.rx) {
    throw new Error(`Expected response 0x${cmd.rx.toString(16)}, got 0x${actual.toString(16)}`)
  }
}
