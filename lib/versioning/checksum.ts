import crypto from 'crypto'

export function stableStringify(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as any).sort())
}

export function checksumFlow(flow: unknown): string {
  const str = stableStringify(flow)
  return crypto.createHash('sha256').update(str).digest('hex')
}
