// app/api/enterprise/demo-booking/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAvailability } from '@/lib/scheduling/availability'
import { scoreLead } from '@/lib/enterprise/leadScoring'
import { sendEmail, renderTemplate } from '@/lib/notifications/email'
import { sendSlackMessage } from '@/lib/notifications/slack'
import { syncHubSpotContact, createHubSpotDeal } from '@/lib/enterprise/hubspot'
import { BookingStatus, CalendarProvider } from '@prisma/client'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      bookingTypeSlug = 'enterprise-demo',
      workspaceSlug = 'skillify-hq',
      guestName,
      guestEmail,
      guestPhone,
      start, // ISO
      end, // ISO (optional, we’ll recompute)
      answers,

      companySize: companySizeDirect,
      budgetRange,
      timeline,
      useCase,
      notes: notesDirect,
      source = 'marketing-demo-page',
    } = body

    if (!guestName || !guestEmail || !start) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const workspace = await prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
    })
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      )
    }

    const bookingType = await prisma.bookingType.findFirst({
      where: {
        workspaceId: workspace.id,
        slug: bookingTypeSlug,
        isActive: true,
      },
    })
    if (!bookingType) {
      return NextResponse.json(
        { error: 'Booking type not found' },
        { status: 404 },
      )
    }

    const from = new Date(start)
    const durationMinutes = bookingType.durationMinutes
    const to = end
      ? new Date(end)
      : new Date(from.getTime() + durationMinutes * 60_000)

    const companySize =
      companySizeDirect || answers?.teamSize || answers?.companySize || null
    const mainGoal = answers?.mainGoal || answers?.goal || useCase || null
    const notes = notesDirect || answers?.notes || null

    // Optional: strict availability check
    const availability = await getAvailability({
      workspaceId: workspace.id,
      bookingTypeSlug,
      from,
      to,
    })

    const fromIso = from.toISOString()
    const toIso = to.toISOString()

    const isSlotAvailable =
      availability.length === 0
        ? true
        : availability.some(
            (slot) =>
              slot.start === fromIso && slot.end === toIso && slot.available,
          )

    if (!isSlotAvailable) {
      return NextResponse.json(
        { error: 'Slot no longer available' },
        { status: 409 },
      )
    }

    // AI lead scoring using derived fields
    const aiScore = await scoreLead({
      companySize: companySize ?? undefined,
      budgetRange: budgetRange ?? undefined,
      timeline: timeline ?? undefined,
      useCase: mainGoal ?? undefined,
      notes: notes ?? undefined,
    })

    const timezone = bookingType.timezone

    const booking = await prisma.booking.create({
      data: {
        workspaceId: workspace.id,
        bookingTypeId: bookingType.id,
        status: BookingStatus.CONFIRMED,
        provider: CalendarProvider.OTHER,
        start: from,
        end: to,
        timezone,
        guestName,
        guestEmail,
        guestPhone,
        source,
        answers: {
          ...(answers || {}),
          companySize,
          budgetRange,
          timeline,
          mainGoal,
          notes,
        },
        aiQualificationScore: aiScore.score,
        aiSummary: aiScore.reasons.join('; '),
      },
    })

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'https://app.skillify.tech'
    const manageUrl = `${appUrl}/manage-booking/${booking.id}`
    const startFormatted = from.toLocaleString('en-US', { timeZone: timezone })

    // Emails
    await Promise.all([
      sendEmail({
        to: guestEmail,
        subject: 'Your Skillify demo is booked',
        html: renderTemplate('demo-booking-confirmation', {
          guestName,
          startFormatted,
          timezone,
          manageUrl,
        }),
      }),
      process.env.SALES_TEAM_EMAIL
        ? sendEmail({
            to: process.env.SALES_TEAM_EMAIL,
            subject: `New demo booking: ${guestName}`,
            html: renderTemplate('demo-booking-internal', {
              guestName,
              guestEmail,
              startFormatted,
              timezone,
              notes,
              aiScore: aiScore.score,
            }),
          })
        : Promise.resolve(),
    ])

    // Slack
    await sendSlackMessage({
      channel: 'sales',
      title: 'New Enterprise Demo Booking',
      text: `${guestName} (${guestEmail}) • Score: *${aiScore.score}* (${aiScore.tier})`,
      fields: [
        { label: 'When', value: startFormatted },
        { label: 'Company size', value: companySize || 'N/A' },
        { label: 'Timeline', value: timeline || 'N/A' },
        { label: 'Budget', value: budgetRange || 'N/A' },
      ],
    })

    // HubSpot
    const contact = await syncHubSpotContact({
      email: guestEmail,
      firstName: guestName.split(' ')[0],
      lastName: guestName.split(' ').slice(1).join(' ') || undefined,
      phone: guestPhone,
      properties: {
        company_size: companySize,
        demo_booked: true,
        lead_score_numeric: aiScore.score,
        lead_score_tier: aiScore.tier,
        demo_source: source,
      },
    })

    if (contact?.id) {
      await createHubSpotDeal({
        title: `Skillify Demo – ${guestName}`,
        contactId: contact.id,
        properties: {
          amount: 0,
          demo_date: from.toISOString(),
        },
      })
    }

    return NextResponse.json({
      ok: true,
      id: booking.id,
      aiScore,
      manageUrl,
    })
  } catch (err) {
    console.error('[demo-booking] Error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
