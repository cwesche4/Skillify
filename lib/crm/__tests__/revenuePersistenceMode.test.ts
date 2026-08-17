import { describe, expect, it } from 'vitest'

import {
  canUsePreviewRevenueFallback,
  durableRevenueFailureMessage,
} from '@/lib/revenue/revenuePersistenceMode'

describe('revenue persistence mode', () => {
  it('allows preview fallback outside production only', () => {
    expect(canUsePreviewRevenueFallback('development')).toBe(true)
    expect(canUsePreviewRevenueFallback('test')).toBe(true)
    expect(canUsePreviewRevenueFallback('production')).toBe(false)
  })

  it('uses a durable-write failure message for production failures', () => {
    expect(durableRevenueFailureMessage()).toContain('durably')
  })
})
