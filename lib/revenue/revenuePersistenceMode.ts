export function canUsePreviewRevenueFallback(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv !== 'production'
}

export function durableRevenueFailureMessage() {
  return 'Revenue could not be saved durably. Nothing was recorded.'
}
