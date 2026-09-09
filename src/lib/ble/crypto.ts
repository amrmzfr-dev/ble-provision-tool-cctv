import { md5 } from 'js-md5'
import forge from 'node-forge'

// TS 5.7+'s stricter typed-array generics mean a plain `Uint8Array` (typed
// `Uint8Array<ArrayBufferLike>`, which includes SharedArrayBuffer) no longer
// satisfies `BufferSource` (which wants `ArrayBufferView<ArrayBuffer>`)
// without help. These Uint8Arrays are always backed by real, non-shared
// ArrayBuffers at runtime, so the cast is safe.
function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as BufferSource
}

// WebCrypto deliberately doesn't implement RSAES-PKCS1-v1_5 decryption (only
// keygen/encrypt for some profiles), which the camera's handshake requires.
// node-forge covers both keygen and decrypt; WebCrypto (crypto.subtle) is
// used for the AES-CBC session once the key is derived.

export interface RsaKeypair {
  /** Raw 128-byte modulus, no DER wrapper — this is what goes on the wire. */
  modulus: Uint8Array
  decrypt: (ciphertext: Uint8Array) => Uint8Array
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

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export function generateRsaKeypair(): RsaKeypair {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 })
  // 1024-bit modulus is always top-bit-set, so this is 256 hex chars (128
  // bytes) in practice; padStart guards the theoretical short case.
  const modulusHex = keypair.publicKey.n.toString(16).padStart(256, '0')

  return {
    modulus: hexToBytes(modulusHex),
    decrypt: (ciphertext: Uint8Array) => {
      const plainStr = keypair.privateKey.decrypt(
        bytesToForgeString(ciphertext),
        'RSAES-PKCS1-V1_5',
      )
      return forgeStringToBytes(plainStr)
    },
  }
}

export interface SessionKey {
  key: Uint8Array // 32 bytes -> AES-256
  iv: Uint8Array // 16 bytes
}

/**
 * secret is the camera's RSA-decrypted response to our public key. Derivation
 * quirk confirmed from the decompiled SDK: the AES key is the *hex text* of
 * MD5(secret), not the 16 raw MD5 bytes — i.e. MD5 it, render as a 32-char
 * lowercase hex string, then use those 32 ASCII characters as the key.
 */
export function deriveSessionKey(secret: Uint8Array): SessionKey {
  if (secret.length % 2 !== 0) {
    throw new Error(
      `Expected an even-length RSA-decrypted secret to split in half for the IV, got ${secret.length} bytes`,
    )
  }
  const iv = secret.slice(0, secret.length / 2)
  if (iv.length !== 16) {
    throw new Error(
      `Derived a ${iv.length}-byte IV, expected 16 — the assumed 32-byte secret length may be wrong on this camera`,
    )
  }

  const digestBytes = md5.array(secret)
  const hex = digestBytes.map((b) => b.toString(16).padStart(2, '0')).join('')
  const key = new TextEncoder().encode(hex)

  return { key, iv }
}

async function importAesKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', asBufferSource(keyBytes), 'AES-CBC', false, ['encrypt', 'decrypt'])
}

/** AES-256-CBC/PKCS7 — WebCrypto's AES-CBC pads/unpads with PKCS7 natively, which is byte-for-byte the same as Java's PKCS5Padding at a 16-byte block size. */
export async function aesCbcEncrypt(data: Uint8Array, session: SessionKey): Promise<Uint8Array> {
  const cryptoKey = await importAesKey(session.key)
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: asBufferSource(session.iv) },
    cryptoKey,
    asBufferSource(data),
  )
  return new Uint8Array(cipher)
}

export async function aesCbcDecrypt(data: Uint8Array, session: SessionKey): Promise<Uint8Array> {
  const cryptoKey = await importAesKey(session.key)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: asBufferSource(session.iv) },
    cryptoKey,
    asBufferSource(data),
  )
  return new Uint8Array(plain)
}
