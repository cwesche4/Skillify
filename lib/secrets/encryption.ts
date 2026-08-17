import crypto from 'crypto'

const KEY_LEN = 32

// Secrets vault.
// Never return plaintext secrets after creation.
// References only in flows.
function getKey(): Buffer {
  const key = process.env.SECRET_ENCRYPTION_KEY
  if (!key || key.length < KEY_LEN) {
    throw new Error('SECRET_ENCRYPTION_KEY must be at least 32 characters')
  }
  return Buffer.from(key).subarray(0, KEY_LEN)
}

export function encryptSecret(plaintext: string) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return { ciphertext: Buffer.concat([encrypted, tag]), iv }
}

export function decryptSecret(ciphertext: Buffer, iv: Buffer): string {
  const tag = ciphertext.subarray(ciphertext.length - 16)
  const data = ciphertext.subarray(0, ciphertext.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}
