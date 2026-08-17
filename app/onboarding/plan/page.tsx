import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

import { OnboardingPlanSelection } from '@/components/billing/OnboardingPlanSelection'
import { getOnboardingDestinationForCurrentUser } from '@/lib/billing/onboardingAccessServer'

export default async function OnboardingPlanPage() {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const destination = await getOnboardingDestinationForCurrentUser()
  if (destination !== '/onboarding/plan') redirect(destination)

  return <OnboardingPlanSelection />
}
