import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

import { OnboardingCheckoutClient } from '@/components/billing/OnboardingCheckoutClient'
import { normalizeBillingPlan } from '@/lib/billing/plans'
import { getOnboardingDestinationForCurrentUser } from '@/lib/billing/onboardingAccessServer'

export default async function OnboardingCheckoutPage({
  searchParams,
}: {
  searchParams?: { plan?: string }
}) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const destination = await getOnboardingDestinationForCurrentUser()
  if (destination !== '/onboarding/plan') redirect(destination)

  return (
    <OnboardingCheckoutClient
      selectedPlan={normalizeBillingPlan(searchParams?.plan)}
    />
  )
}
