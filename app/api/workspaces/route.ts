// app/api/workspaces/route.ts
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { WorkspaceMemberRole } from '@/lib/prisma/enums'
import { logAudit } from '@/lib/audit/log'

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function generateUniqueWorkspaceSlug(name: string) {
  const base = slugify(name) || 'workspace'
  let slug = base
  let counter = 1

  while (true) {
    const exists = await prisma.workspace.findUnique({ where: { slug } })
    if (!exists) return slug
    counter += 1
    slug = `${base}-${counter}`
  }
}

export async function GET() {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json([])

  const memberships = await prisma.workspaceMember.findMany({
    where: { user: { clerkId } },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(
    memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      ownerId: m.workspace.ownerId,
      createdAt: m.workspace.createdAt,
      updatedAt: m.workspace.updatedAt,
      memberRole: m.role,
    })),
  )
}

export async function POST(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
  })
  if (!profile)
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  let body: any = null
  try {
    body = await req.json()
  } catch {
    // ignore
  }

  const name = String(body?.name ?? '').trim()
  if (!name)
    return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const slug = await generateUniqueWorkspaceSlug(name)

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      ownerId: profile.id,
      members: {
        create: {
          userId: profile.id,
          role: WorkspaceMemberRole.OWNER,
        },
      },
    },
  })

  // 🔒 AUDIT LOG — WORKSPACE CREATED
  await logAudit({
    workspaceId: workspace.id,
    actorId: profile.id,
    action: 'WORKSPACE_CREATED',
    targetType: 'Workspace',
    targetId: workspace.id,
    meta: { name: workspace.name, slug: workspace.slug },
  })

  return NextResponse.json({ ok: true, workspace })
}
