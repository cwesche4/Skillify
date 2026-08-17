import crypto from 'crypto'

export type IntegrationOAuthReturnDestination = {
  kind: 'setup' | 'settings'
  path: string
  setupStep?: string
}

export type IntegrationOAuthStatePayload = {
  providerId: string
  workspaceId: string
  userId: string
  workspaceMemberId?: string
  nonce: string
  returnDestination: IntegrationOAuthReturnDestination
  createdAt: string
  expiresAt: string
}

type SignedOAuthStateEnvelope = {
  version: 1
  payload: IntegrationOAuthStatePayload
  signature: string
}

function getStateSigningSecret(): string {
  const secret =
    process.env.SECRET_ENCRYPTION_KEY ||
    process.env.INTEGRATIONS_ENCRYPTION_KEY ||
    process.env.CLERK_SECRET_KEY
  if (!secret) {
    throw new Error(
      'SECRET_ENCRYPTION_KEY or INTEGRATIONS_ENCRYPTION_KEY must be configured before creating integration OAuth state.',
    )
  }
  return secret
}

function signPayload(payload: IntegrationOAuthStatePayload): string {
  return crypto
    .createHmac('sha256', getStateSigningSecret())
    .update(JSON.stringify(payload))
    .digest('base64url')
}

function isSafeReturnPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://')
}

export function createIntegrationOAuthState({
  providerId,
  workspaceId,
  userId,
  workspaceMemberId,
  returnDestination,
  ttlMs = 10 * 60_000,
}: {
  providerId: string
  workspaceId: string
  userId: string
  workspaceMemberId?: string
  returnDestination: IntegrationOAuthReturnDestination
  ttlMs?: number
}): string {
  if (!isSafeReturnPath(returnDestination.path)) {
    throw new Error(
      'Integration OAuth return destination must be a safe relative path.',
    )
  }
  const createdAt = new Date()
  const payload: IntegrationOAuthStatePayload = {
    providerId,
    workspaceId,
    userId,
    workspaceMemberId,
    nonce: crypto.randomBytes(16).toString('base64url'),
    returnDestination,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + ttlMs).toISOString(),
  }
  const envelope: SignedOAuthStateEnvelope = {
    version: 1,
    payload,
    signature: signPayload(payload),
  }
  return Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url')
}

export function verifyIntegrationOAuthState({
  state,
  expectedProviderId,
  expectedWorkspaceId,
  now = new Date(),
}: {
  state: string
  expectedProviderId: string
  expectedWorkspaceId: string
  now?: Date
}): IntegrationOAuthStatePayload {
  const envelope = JSON.parse(
    Buffer.from(state, 'base64url').toString('utf8'),
  ) as SignedOAuthStateEnvelope
  if (envelope.version !== 1)
    throw new Error('Unsupported integration OAuth state.')
  if (envelope.signature !== signPayload(envelope.payload)) {
    throw new Error('Integration OAuth state signature is invalid.')
  }
  if (envelope.payload.providerId !== expectedProviderId) {
    throw new Error('Integration OAuth state provider mismatch.')
  }
  if (envelope.payload.workspaceId !== expectedWorkspaceId) {
    throw new Error('Integration OAuth state workspace mismatch.')
  }
  if (new Date(envelope.payload.expiresAt).getTime() < now.getTime()) {
    throw new Error('Integration OAuth state expired.')
  }
  if (!isSafeReturnPath(envelope.payload.returnDestination.path)) {
    throw new Error('Integration OAuth state return path is unsafe.')
  }
  return envelope.payload
}
