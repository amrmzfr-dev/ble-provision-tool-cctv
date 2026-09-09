import forge from 'node-forge'
import { describe, expect, it } from 'vitest'
import { aesCbcDecrypt, aesCbcEncrypt, deriveSessionKey, generateRsaKeypair } from './crypto'

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function bytesToForgeString(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return str
}

function forgeStringToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes
}

describe('RSA keypair generation + decrypt', () => {
  it('produces a 128-byte modulus and can decrypt data encrypted against its own public key', () => {
    const keypair = generateRsaKeypair()
    expect(keypair.modulus.length).toBe(128)

    // Simulates "the camera encrypts a secret against the modulus we sent
    // it" by reconstructing a forge public key from the exposed raw
    // modulus (n) and the exponent generateRsaKeypair always uses (65537) —
    // this is exactly what n/e fully determine, no access to module
    // internals needed.
    const n = new forge.jsbn.BigInteger(bytesToHex(keypair.modulus), 16)
    const e = new forge.jsbn.BigInteger('10001', 16)
    const publicKey = forge.pki.setRsaPublicKey(n, e)

    const secret = crypto.getRandomValues(new Uint8Array(32))
    const ciphertextStr = publicKey.encrypt(bytesToForgeString(secret), 'RSAES-PKCS1-V1_5')
    const ciphertext = forgeStringToBytes(ciphertextStr)

    const decrypted = keypair.decrypt(ciphertext)
    expect(Array.from(decrypted)).toEqual(Array.from(secret))
  })
})

describe('deriveSessionKey', () => {
  it('derives a 32-byte key and a 16-byte IV that is exactly the first half of the secret', () => {
    const secret = new Uint8Array(32).map((_, i) => i)
    const session = deriveSessionKey(secret)
    expect(session.key.length).toBe(32)
    expect(session.iv.length).toBe(16)
    expect(Array.from(session.iv)).toEqual(Array.from(secret.slice(0, 16)))
  })

  it('throws a clear error instead of silently producing a wrong-sized IV', () => {
    expect(() => deriveSessionKey(new Uint8Array(31))).toThrow(/even-length/)
    expect(() => deriveSessionKey(new Uint8Array(40))).toThrow(/16/)
  })
})

describe('AES-256-CBC round trip', () => {
  it('encrypts then decrypts back to the exact original bytes', async () => {
    const session = deriveSessionKey(new Uint8Array(32).map((_, i) => i * 3))
    const original = new TextEncoder().encode('hello camera, this is a test frame')

    const ciphertext = await aesCbcEncrypt(original, session)
    const plaintext = await aesCbcDecrypt(ciphertext, session)

    expect(Array.from(plaintext)).toEqual(Array.from(original))
  })
})
