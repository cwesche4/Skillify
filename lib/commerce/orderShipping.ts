import type {
  CommerceShippingCostState,
  CommerceShippingPayer,
} from '@/lib/commerce/types'

export type ShippingCostSeedInput = {
  payer: CommerceShippingPayer
  shippingCharge: string
  shippingCost: string
  shippingCostTouched: boolean
  shippingCostState: CommerceShippingCostState
}

export function maybeSeedEstimatedShippingCostFromCharge({
  payer,
  shippingCharge,
  shippingCost,
  shippingCostTouched,
  shippingCostState,
}: ShippingCostSeedInput): Pick<
  ShippingCostSeedInput,
  'shippingCost' | 'shippingCostTouched' | 'shippingCostState'
> {
  if (
    payer === 'CUSTOMER' &&
    shippingCharge.trim() !== '' &&
    shippingCost.trim() === '' &&
    !shippingCostTouched
  ) {
    return {
      shippingCost: shippingCharge,
      shippingCostTouched: false,
      shippingCostState: 'ESTIMATED',
    }
  }
  return { shippingCost, shippingCostTouched, shippingCostState }
}

export function useChargeAsEstimatedShippingCost(shippingCharge: string) {
  return {
    shippingCost: shippingCharge,
    shippingCostTouched: true,
    shippingCostState: 'ESTIMATED' as const,
  }
}
