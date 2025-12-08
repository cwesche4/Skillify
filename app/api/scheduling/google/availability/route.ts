// app/api/scheduling/availability/route.ts

import { NextResponse } from 'next/server'
import { getAvailability } from '@/lib/scheduling/availability'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceSlug = searchParams.get('workspaceSlug') || 'skillify-hq'
    const bookingTypeSlug =
      searchParams.get('bookingTypeSlug') || 'enterprise-demo'
    const fromStr = searchParams.get('from')
    const toStr = searchParams.get('to')

    if (!fromStr || !toStr) {
      return NextResponse.json({ error: 'Missing from/to' }, { status: 400 })
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

    const from = new Date(fromStr)
    const to = new Date(toStr)

    const slots = await getAvailability({
      workspaceId: workspace.id,
      bookingTypeSlug,
      from,
      to,
    })

    return NextResponse.json({ slots })
  } catch (err) {
    console.error('[availability] Error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
