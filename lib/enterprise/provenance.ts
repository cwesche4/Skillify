import crypto from 'crypto'

// Execution provenance.
// Read-only metadata.
// No behavioral impact.
export function computeRunFingerprint(payload: Record<string, any>): string {
  const json = JSON.stringify(payload)
  return crypto.createHash('sha256').update(json).digest('hex')
}

export function computeEnvironmentHash(env: Record<string, any>): string {
  const json = JSON.stringify(env)
  return crypto.createHash('sha256').update(json).digest('hex')
}

export const BUILDER_VERSION_STAMP = 'builder-v5-trust-layer'
