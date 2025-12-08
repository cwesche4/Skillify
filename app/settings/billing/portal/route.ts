import { auth, clerkClient } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
// import Stripe from "stripe"; // uncomment when you add Stripe

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  // Placeholder: look up Stripe customer ID from metadata
  const stripeCustomerId = (user.privateMetadata as any)?.stripeCustomerId

  if (!stripeCustomerId) {
    // For now, just return to settings
    return NextResponse.redirect(new URL('/settings', req.url))
  }

  // When you add Stripe, this is where you'd create a billing portal session:
  //
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  //   apiVersion: "2023-10-16",
  // });
  //
  // const session = await stripe.billingPortal.sessions.create({
  //   customer: stripeCustomerId,
  //   return_url: new URL("/settings", req.url).toString(),
  // });
  //
  // return NextResponse.redirect(session.url);

  return NextResponse.redirect(new URL('/settings', req.url))
}
