// app/api/upsell/request-micro/route.ts

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { notifyMicroUpsellRequest } from '@/lib/notifications/notifyUpsell'

type Body = {
  workspaceId?: string | null
  automationId?: string | null
  feature: string
  description: string
  priceHint?: string | null
}

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = auth()
    const body = (await req.json()) as Body

    if (!body.feature || !body.description) {
      return NextResponse.json(
        { error: 'Missing feature or description' },
        { status: 400 },
      )
    }

    // Try to resolve userProfile (optional for public)
    const userProfile = clerkId
      ? await prisma.userProfile.findUnique({ where: { clerkId } })
      : null

    // Try to persist if we have a workspace + userProfile
    if (body.workspaceId && body.workspaceId !== 'public' && userProfile) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: body.workspaceId },
      })

      if (workspace) {
        await prisma.upsellRequest.create({
          data: {
            workspaceId: workspace.id,
            userId: userProfile.id,
            automationId: body.automationId ?? undefined,
            type: 'micro',
            description: body.description,
            status: 'pending',
          },
        })
      }
    }

    await notifyMicroUpsellRequest({
      workspaceId: body.workspaceId ?? null,
      userEmail: userProfile ? undefined : null, // you can add email from Clerk if desired
      feature: body.feature,
      description: body.description,
      priceHint: body.priceHint ?? null,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Micro upsell request failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
