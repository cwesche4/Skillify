export type CRMFailureCategory =
  | 'transient'
  | 'auth'
  | 'config'
  | 'provider'
  | 'unknown'

export function classifyCRMError(message?: string): CRMFailureCategory {
  if (!message) return 'unknown'
  const msg = message.toLowerCase()

  // Transient/network/rate limits/timeouts
  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('etimedout') ||
    msg.includes('econn') ||
    msg.includes('rate limit') ||
    msg.includes('429')
  ) {
    return 'transient'
  }

  // Auth/token issues
  if (
    msg.includes('401') ||
    msg.includes('unauthorized') ||
    msg.includes('invalid token') ||
    msg.includes('expired')
  ) {
    return 'auth'
  }

  // Config/plan/disable
  if (
    msg.includes('elite plan required') ||
    msg.includes('actions disabled') ||
    msg.includes('inbound crm disabled') ||
    msg.includes('integration disabled') ||
    msg.includes('plan insufficient')
  ) {
    return 'config'
  }

  // Provider/HTTP errors
  if (
    msg.includes('hubspot') ||
    msg.includes('4xx') ||
    msg.includes('5xx') ||
    msg.includes('failed to refresh') ||
    msg.includes('provider')
  ) {
    return 'provider'
  }

  return 'unknown'
}
