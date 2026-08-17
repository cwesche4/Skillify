import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const ENCRYPTION_KEY_ERROR =
  'INTEGRATIONS_ENCRYPTION_KEY must be configured before storing or reading provider credentials. Generate one with: openssl rand -base64 32'

function loadKey({
  throwOnInvalid = true,
}: { throwOnInvalid?: boolean } = {}): Buffer | null {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY
  if (!raw) return null

  // Accept base64; decode and validate 32 bytes
  let decoded: Buffer
  try {
    decoded = Buffer.from(raw, 'base64')
  } catch (err) {
    if (!throwOnInvalid) return null
    throw new Error(
      'INTEGRATIONS_ENCRYPTION_KEY must be a base64-encoded 32-byte key (openssl rand -base64 32)',
    )
  }

  if (decoded.length !== 32) {
    if (!throwOnInvalid) return null
    throw new Error(
      'INTEGRATIONS_ENCRYPTION_KEY must decode to exactly 32 bytes (use openssl rand -base64 32)',
    )
  }

  return decoded
}

export function isIntegrationEncryptionConfigured(): boolean {
  return loadKey({ throwOnInvalid: false }) !== null
}

export function assertIntegrationEncryptionConfigured(): void {
  if (!loadKey()) {
    throw new Error(ENCRYPTION_KEY_ERROR)
  }
}

function getRequiredKey(): Buffer {
  const key = loadKey()
  if (!key) {
    throw new Error(ENCRYPTION_KEY_ERROR)
  }
  return key
}

export function encryptToken(token: string): string {
  const key = getRequiredKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptToken(payload: string): string {
  const key = getRequiredKey()
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}

export type IntegrationEncryptedEnvelope = {
  version: 1
  algorithm: 'aes-256-gcm'
  keyId: 'integrations:v1'
  ciphertext: string
}

export function encryptIntegrationPayload(
  payload: Record<string, unknown>,
): string {
  return JSON.stringify({
    version: 1,
    algorithm: ALGO,
    keyId: 'integrations:v1',
    ciphertext: encryptToken(JSON.stringify(payload)),
  } satisfies IntegrationEncryptedEnvelope)
}

export function decryptIntegrationPayload(
  encryptedPayload: string,
): Record<string, unknown> {
  const envelope = JSON.parse(
    encryptedPayload,
  ) as Partial<IntegrationEncryptedEnvelope>
  if (
    envelope.version !== 1 ||
    envelope.algorithm !== ALGO ||
    envelope.keyId !== 'integrations:v1' ||
    typeof envelope.ciphertext !== 'string'
  ) {
    throw new Error('Unsupported integration credential envelope.')
  }
  return JSON.parse(decryptToken(envelope.ciphertext)) as Record<
    string,
    unknown
  >
}

export function maskSecretHint(secret: string): string {
  const trimmed = secret.trim()
  if (trimmed.length <= 4) return '••••'
  return `••••${trimmed.slice(-4)}`
}
