// app/api/enterprise/request-consult/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { scoreLead } from '@/lib/enterprise/leadScoring'
import { sendSlackMessage } from '@/lib/notifications/slack'
import { sendEmail, renderTemplate } from '@/lib/notifications/email'
import { syncHubSpotContact, createHubSpotDeal } from '@/lib/enterprise/hubspot'
import { EnterpriseStatus } from '@prisma/client'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      workspaceId = 'public',
      userId,
      name,
      email,
      phone,
      companySize,
      projectGoal,
      description,
      budgetRange,
      timeline,
      useCase,
    } = body

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Missing name or email' },
        { status: 400 },
      )
    }

    const leadScore = await scoreLead({
      companySize,
      budgetRange,
      timeline,
      useCase,
      notes: description,
    })

    const consult = await prisma.enterpriseConsultRequest.create({
      data: {
        workspaceId,
        userId: userId ?? 'public',
        name,
        email,
        phone,
        companySize,
        projectGoal,
        description,
        status: EnterpriseStatus.NEW,
      },
    })

    // Slack notification
    await sendSlackMessage({
      channel: 'enterprise',
      title: 'New Enterprise Consult Request',
      text: `New enterprise lead: *${name}* (${email}) • Score: *${leadScore.score}* (${leadScore.tier})`,
      fields: [
        { label: 'Company size', value: companySize || 'N/A' },
        { label: 'Timeline', value: timeline || 'N/A' },
        { label: 'Budget', value: budgetRange || 'N/A' },
        { label: 'Workspace', value: workspaceId },
      ],
    })

    // Emails
    await Promise.all([
      sendEmail({
        to: email,
        subject: 'We received your Skillify Enterprise request',
        html: renderTemplate('enterprise-consult-confirmation', {
          name,
          email,
          companySize,
          projectGoal,
          description,
        }),
      }),
      process.env.SALES_TEAM_EMAIL
        ? sendEmail({
            to: process.env.SALES_TEAM_EMAIL,
            subject: `New enterprise consult: ${name}`,
            html: renderTemplate('enterprise-consult-internal', {
              name,
              email,
              phone,
              companySize,
              projectGoal,
              description,
              aiScore: leadScore.score,
            }),
          })
        : Promise.resolve(),
    ])

    // HubSpot
    const contact = await syncHubSpotContact({
      email,
      firstName: name.split(' ')[0],
      lastName: name.split(' ').slice(1).join(' ') || undefined,
      phone,
      properties: {
        company_size: companySize,
        project_goal: projectGoal,
        lead_score_numeric: leadScore.score,
        lead_score_tier: leadScore.tier,
        enterprise_origin: 'consult-form',
      },
    })

    if (contact?.id) {
      await createHubSpotDeal({
        title: `Skillify Enterprise – ${name}`,
        pipelineId: process.env.HUBSPOT_PIPELINE_ID,
        stageId: process.env.HUBSPOT_DEAL_STAGE_NEW,
        contactId: contact.id,
        properties: {
          dealtype: 'newbusiness',
          hubspot_owner_id: process.env.HUBSPOT_OWNER_ID,
        },
      })
    }

    return NextResponse.json({
      ok: true,
      id: consult.id,
      score: leadScore,
    })
  } catch (err) {
    console.error('[request-consult] Error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
