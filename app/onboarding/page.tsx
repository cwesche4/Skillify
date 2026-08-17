import { redirectToCurrentOnboardingDestination } from '@/lib/billing/onboardingAccessServer'

export default async function OnboardingPage() {
  await redirectToCurrentOnboardingDestination()
}
