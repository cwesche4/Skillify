import { describe, expect, it } from 'vitest'

import {
  maybeSeedEstimatedShippingCostFromCharge,
  useChargeAsEstimatedShippingCost,
} from '@/lib/commerce/orderShipping'

describe('order shipping initialization', () => {
  it('seeds estimated cost from customer charge only when blank and untouched', () => {
    expect(
      maybeSeedEstimatedShippingCostFromCharge({
        payer: 'CUSTOMER',
        shippingCharge: '7.99',
        shippingCost: '',
        shippingCostTouched: false,
        shippingCostState: 'ESTIMATED',
      }),
    ).toEqual({
      shippingCost: '7.99',
      shippingCostTouched: false,
      shippingCostState: 'ESTIMATED',
    })
  })

  it('does not overwrite a manually edited shipping cost', () => {
    expect(
      maybeSeedEstimatedShippingCostFromCharge({
        payer: 'CUSTOMER',
        shippingCharge: '10.00',
        shippingCost: '5.00',
        shippingCostTouched: true,
        shippingCostState: 'ACTUAL',
      }),
    ).toEqual({
      shippingCost: '5.00',
      shippingCostTouched: true,
      shippingCostState: 'ACTUAL',
    })
  })

  it('does not seed customer charge into cost for business-paid shipping', () => {
    expect(
      maybeSeedEstimatedShippingCostFromCharge({
        payer: 'BUSINESS',
        shippingCharge: '10.00',
        shippingCost: '',
        shippingCostTouched: false,
        shippingCostState: 'ESTIMATED',
      }).shippingCost,
    ).toBe('')
  })

  it('explicitly copies charge as estimated cost when requested', () => {
    expect(useChargeAsEstimatedShippingCost('12.50')).toEqual({
      shippingCost: '12.50',
      shippingCostTouched: true,
      shippingCostState: 'ESTIMATED',
    })
  })
})
