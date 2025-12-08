// app/api/upsell/request-build/route.ts

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { notifyBuildUpsellRequest } from '@/lib/notifications/upsell'

const BodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  size: z.string().optional().nullable(),

  projectType: z.string().optional().nullable(),
  projectSummary: z.string().min(10),
  automationCount: z.number().int().min(1).max(500).optional().nullable(),
  budgetRange: z.string().optional().nullable(),
  timeline: z.string().optional().nullable(),

  // Workspace is optional for marketing/public leads
  workspaceId: z.string().optional().nullable(),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const body = BodySchema.parse(json)

    // Normalize fields to null for Prisma
    const cleaned = {
      name: body.name,
      email: body.email,
      phone: body.phone || null,
      company: body.company || null,
      website: body.website || null,
      size: body.size || null,
      projectType: body.projectType || null,
      projectSummary: body.projectSummary,
      automationCount: body.automationCount ?? null,
      budgetRange: body.budgetRange || null,
      timeline: body.timeline || null,
      workspaceId: body.workspaceId || null,
    }

    // 1) Save Build Request
    const record = await prisma.buildRequest.create({
      data: cleaned,
    })

    // 2) Send fan-out notifications
    await notifyBuildUpsellRequest({
      workspaceId: record.workspaceId ?? 'public/marketing',
      workspaceName: undefined,
      userId: undefined,
      userEmail: record.email,

      name: record.name,
      email: record.email,
      phone: record.phone,
      company: record.company,
      website: record.website,
      size: record.size,

      projectType: record.projectType,
      projectSummary: record.projectSummary,
      automationCount: record.automationCount,
      budgetRange: record.budgetRange,
      timeline: record.timeline,

      raw: body,
    })

    return NextResponse.json({ ok: true, id: record.id })
  } catch (err) {
    console.error('[upsell] request-build failed', err)
    return NextResponse.json(
      { ok: false, error: 'Invalid request' },
      { status: 400 },
    )
  }
}
