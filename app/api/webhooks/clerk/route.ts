// app/api/webhooks/clerk/route.ts

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import {
  clerkWebhookIdentity,
  ensureUserProfileFromClerkIdentity,
} from '@/lib/auth/userProfileLifecycle'

// ----------------------------------------
// ENV CHECK
// ----------------------------------------
function getWebhookSecret() {
  return process.env.CLERK_WEBHOOK_SECRET
}

// ----------------------------------------
// WEBHOOK HANDLER
// ----------------------------------------
export async function POST(req: Request) {
  const webhookSecret = getWebhookSecret()
  if (!webhookSecret) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Skillify][clerk-webhook] missing CLERK_WEBHOOK_SECRET')
    }
    return NextResponse.json(
      { error: 'Clerk webhook secret is not configured.' },
      { status: 503 },
    )
  }

  const payload = await req.text()
  const h = headers()

  const svixHeaders = {
    'svix-id': h.get('svix-id') ?? '',
    'svix-timestamp': h.get('svix-timestamp') ?? '',
    'svix-signature': h.get('svix-signature') ?? '',
  }

  let event: any
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(payload, svixHeaders)
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const { type, data } = event

  // ---------------------------------------------------------
  // USER CREATED
  // ---------------------------------------------------------
  if (type === 'user.created' || type === 'user.updated') {
    const identity = clerkWebhookIdentity(data)
    if (!identity.clerkId) {
      return NextResponse.json(
        { error: 'Missing Clerk user id' },
        { status: 400 },
      )
    }

    await ensureUserProfileFromClerkIdentity(identity)

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[Skillify][clerk-webhook] UserProfile synced for ${
          identity.email ?? identity.clerkId
        }`,
      )
    }
  }

  // ---------------------------------------------------------
  // Workspace creation is intentionally handled by the explicit onboarding
  // Create Workspace flow. A Clerk account is a user, not a business workspace.
  // ---------------------------------------------------------

  return NextResponse.json({ success: true })
}
