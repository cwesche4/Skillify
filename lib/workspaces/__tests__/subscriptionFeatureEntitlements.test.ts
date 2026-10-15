import { describe, expect, it } from 'vitest'

import { FeatureMatrix } from '@/lib/subscriptions/features'
import { hasFeature } from '@/lib/subscriptions/hasFeature'

describe('subscription feature identifiers', () => {
  it('grants dashboard activity to every canonical plan, including Pro', () => {
    expect(FeatureMatrix['dashboard.activity']).toEqual([
      'Free',
      'Basic',
      'Pro',
      'Elite',
    ])
    expect(hasFeature('Pro', 'dashboard.activity')).toBe(true)
  })

  it('keeps AI Coach explain access aligned to Pro and Elite', () => {
    expect(hasFeature('Free', 'coach.explain')).toBe(false)
    expect(hasFeature('Basic', 'coach.explain')).toBe(false)
    expect(hasFeature('Pro', 'coach.explain')).toBe(true)
    expect(hasFeature('Elite', 'coach.explain')).toBe(true)
  })
})
