import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const data = await req.json()

  const {
    workspaceId,
    bookingTypeId,
    name,
    email,
    phone,
    start,
    end,
    answers,
    source,
  } = data

  const booking = await prisma.booking.create({
    data: {
      workspaceId,
      bookingTypeId,
      guestName: name,
      guestEmail: email,
      guestPhone: phone,
      start: new Date(start),
      end: new Date(end),
      timezone: 'UTC',
      answers,
      source,
      status: 'PENDING',
    },
  })

  // AI qualification (placeholder)
  const aiQualificationScore = Math.floor(Math.random() * 100)

  await prisma.booking.update({
    where: { id: booking.id },
    data: { aiQualificationScore },
  })

  return NextResponse.json({ booking })
}
