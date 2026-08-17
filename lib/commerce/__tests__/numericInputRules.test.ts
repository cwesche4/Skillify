import { describe, expect, it } from 'vitest'

import { commerceNumericInputRules } from '@/lib/commerce/numericInputRules'

describe('commerce numeric input rules', () => {
  it('uses cent precision for money fields', () => {
    expect(commerceNumericInputRules.money).toMatchObject({
      min: '0',
      step: '0.01',
      inputMode: 'decimal',
    })
  })

  it('uses integer increments for quantity and inventory fields', () => {
    expect(commerceNumericInputRules.quantity).toMatchObject({
      min: '1',
      step: '1',
      inputMode: 'numeric',
    })
    expect(commerceNumericInputRules.inventory).toMatchObject({
      min: '0',
      step: '1',
      inputMode: 'numeric',
    })
  })

  it('bounds percentage fields while permitting decimal entry', () => {
    expect(commerceNumericInputRules.percentage).toMatchObject({
      min: '0',
      max: '100',
      step: '1',
      inputMode: 'decimal',
    })
  })
})
