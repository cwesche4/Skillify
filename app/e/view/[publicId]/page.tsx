import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { PublicEstimateClient } from '@/components/estimates/PublicEstimateClient'
import { getPublicEstimate } from '@/lib/estimates/customerExperience'
import {
  ESTIMATE_SHARE_SESSION_COOKIE,
  verifyEstimateShareSession,
} from '@/lib/estimates/customerExperienceSecurity'

export const metadata: Metadata = {
  title: 'Estimate',
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

export default async function PublicEstimatePage({
  params,
}: {
  params: { publicId: string }
}) {
  const session = verifyEstimateShareSession(
    cookies().get(ESTIMATE_SHARE_SESSION_COOKIE)?.value,
  )
  if (!session || session.publicId !== params.publicId) {
    return <UnavailableEstimate />
  }
  try {
    const estimate = await getPublicEstimate({
      publicId: session.publicId,
      csrfToken: session.csrfToken,
    })
    return (
      <PublicEstimateClient
        publicId={params.publicId}
        initialEstimate={estimate}
      />
    )
  } catch {
    return <UnavailableEstimate />
  }
}

function UnavailableEstimate() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-12 sm:px-6">
      <section className="border-app w-full rounded-2xl border bg-white p-6 shadow-sm sm:p-10">
        <h1 className="text-app-primary text-2xl font-semibold">
          Estimate unavailable
        </h1>
        <p className="text-app-muted mt-3">
          This Estimate link is unavailable. Contact the business that sent it
          for assistance.
        </p>
      </section>
    </main>
  )
}
