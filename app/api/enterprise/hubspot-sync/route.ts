// app/api/enterprise/hubspot-sync/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncHubSpotContact, createHubSpotDeal } from '@/lib/enterprise/hubspot'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { consultId } = body

    if (!consultId) {
      return NextResponse.json({ error: 'Missing consultId' }, { status: 400 })
    }

    const consult = await prisma.enterpriseConsultRequest.findUnique({
      where: { id: consultId },
    })

    if (!consult) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const contact = await syncHubSpotContact({
      email: consult.email,
      firstName: consult.name.split(' ')[0],
      lastName: consult.name.split(' ').slice(1).join(' ') || undefined,
      properties: {
        company_size: consult.companySize,
        project_goal: consult.projectGoal,
        enterprise_origin: 'manual-sync',
      },
    })

    let deal = null
    if (contact?.id) {
      deal = await createHubSpotDeal({
        title: `Skillify Enterprise – ${consult.name}`,
        contactId: contact.id,
      })
    }

    return NextResponse.json({
      ok: true,
      contact,
      deal,
    })
  } catch (err) {
    console.error('[hubspot-sync] Error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
