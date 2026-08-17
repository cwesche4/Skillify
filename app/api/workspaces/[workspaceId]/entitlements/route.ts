import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { getWorkspaceEntitlementDetails } from '@/lib/enterprise/entitlements'

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

  const entitlements = await getWorkspaceEntitlementDetails(workspaceId)

  return NextResponse.json({
    workspaceId,
    entitlements: entitlements.map((e) => ({
      key: e.key,
      source: e.source,
      effectiveAt: e.effectiveAt,
      expiresAt: e.expiresAt,
      active: e.active,
    })),
    fetchedAt: new Date().toISOString(),
  })
}
