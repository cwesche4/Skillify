import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { stringify } from 'csv-stringify/sync'

export async function GET(
  req: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = params.workspaceId
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!profile)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: profile.id },
    select: { role: true },
  })
  const isAdmin = membership?.role === 'ADMIN' || membership?.role === 'OWNER'
  if (!isAdmin)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const visible: Array<{
    entitlementKey: string
    action: string
    source: string
    effectiveAt: Date
    createdAt: Date
  }> = []
  const nextCursor = null

  if (url.searchParams.get('format') === 'csv') {
    const csv = stringify(
      visible.map((i) => ({
        entitlementKey: i.entitlementKey,
        action: i.action,
        source: i.source,
        effectiveAt: i.effectiveAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
      })),
      { header: true },
    )
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="entitlement-history.csv"',
      },
    })
  }

  return NextResponse.json({
    workspaceId,
    items: visible,
    nextCursor,
    enabled: false,
    reason: 'Enterprise entitlement storage not configured',
  })
}
