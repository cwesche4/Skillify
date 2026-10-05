import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function POST(_req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(
    {
      error:
        'Self-service trials are unavailable during the controlled launch. Approved pilot access is provisioned separately.',
      code: 'SELF_SERVICE_BILLING_DISABLED',
    },
    { status: 503 },
  )
}
