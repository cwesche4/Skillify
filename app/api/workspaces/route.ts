// app/api/workspaces/route.ts
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { WorkspaceBusinessModel, WorkspaceMemberRole } from '@/lib/prisma/enums'
import { logAudit } from '@/lib/audit/log'
import { getWorkspaceBusinessModelDefaults } from '@/lib/workspaces/businessModelRegistry'
import { ensureWorkspaceAIProfile } from '@/lib/ai/ensureWorkspaceAIProfile'
import { ensureUserProfileFromClerkIdentity } from '@/lib/auth/userProfileLifecycle'
import { hasActiveSubscriptionAccess } from '@/lib/billing/onboardingAccess'
import {
  getWorkspaceSlugCandidate,
  isPrismaUniqueConstraintError,
} from '@/lib/workspaces/workspaceSlugs'

function normalizeBusinessModel(raw: unknown) {
  return typeof raw === 'string' && raw in WorkspaceBusinessModel
    ? (raw as WorkspaceBusinessModel)
    : WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? '')
}

function isWorkspaceBusinessModelSchemaError(
  error: unknown,
  businessModel: WorkspaceBusinessModel,
) {
  const message = getErrorMessage(error)
  return (
    businessModel === WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS &&
    /WorkspaceBusinessModel|SIMPLE_SERVICE_BUSINESS|invalid input value for enum/i.test(
      message,
    )
  )
}

function logWorkspaceCreateFailure({
  error,
  businessModel,
  name,
  slug,
}: {
  error: unknown
  businessModel: WorkspaceBusinessModel
  name: string
  slug: string
}) {
  if (process.env.NODE_ENV === 'production') return
  console.error('[Skillify][workspace-create] failed before workspace commit', {
    stage: 'prisma.workspace.create',
    condition: isWorkspaceBusinessModelSchemaError(error, businessModel)
      ? 'WORKSPACE_BUSINESS_MODEL_SCHEMA_NOT_READY'
      : 'WORKSPACE_CREATE_FAILED',
    businessModel,
    name,
    slug,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: getErrorMessage(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
}

function getWorkspaceCreateErrorResponse(
  error: unknown,
  businessModel: WorkspaceBusinessModel,
) {
  if (isWorkspaceBusinessModelSchemaError(error, businessModel)) {
    return NextResponse.json(
      {
        error:
          'Service Business is not available in this database yet. Run the latest workspace migrations and try again.',
        code: 'WORKSPACE_BUSINESS_MODEL_SCHEMA_NOT_READY',
      },
      { status: 503 },
    )
  }

  return NextResponse.json(
    { error: 'Workspace could not be created. Please try again.' },
    { status: 500 },
  )
}

export async function GET(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json([])
  const url = new URL(req.url)
  const includeArchived = url.searchParams.get('includeArchived') === '1'

  const memberships = await prisma.workspaceMember.findMany({
    where: {
      user: { clerkId },
      ...(includeArchived ? {} : { workspace: { archivedAt: null } }),
    },
    include: {
      workspace: {
        include: {
          owner: { select: { id: true, fullName: true, email: true } },
          members: { select: { id: true } },
          subscription: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(
    memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      ownerId: m.workspace.ownerId,
      ownerName:
        m.workspace.owner.fullName ?? m.workspace.owner.email ?? 'Owner',
      businessName: (m.workspace as any).businessName ?? null,
      industry: (m.workspace as any).industry ?? null,
      businessModel: (m.workspace as any).businessModel,
      opportunitiesEnabled: (m.workspace as any).opportunitiesEnabled,
      commerceEnabled: (m.workspace as any).commerceEnabled,
      customerSingularLabel: (m.workspace as any).customerSingularLabel,
      customerPluralLabel: (m.workspace as any).customerPluralLabel,
      salesLabel: (m.workspace as any).salesLabel,
      plan: m.workspace.subscription?.plan ?? 'Free',
      renewalDate: m.workspace.subscription?.currentPeriodEnd ?? null,
      membersCount: m.workspace.members.length,
      archivedAt: (m.workspace as any).archivedAt ?? null,
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

  let profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    include: { subscription: true },
  })
  if (!profile) {
    const user = await clerkClient.users.getUser(clerkId)
    const createdProfile = await ensureUserProfileFromClerkIdentity({
      clerkId,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.primaryEmailAddress?.emailAddress ?? null,
    })
    profile = { ...createdProfile, subscription: null }
  }

  if (!hasActiveSubscriptionAccess(profile.subscription as any)) {
    return NextResponse.json(
      {
        error: 'Choose a plan and activate access before creating a workspace.',
        code: 'ENTITLEMENT_REQUIRED',
      },
      { status: 402 },
    )
  }

  let body: any = null
  try {
    body = await req.json()
  } catch {
    // ignore
  }

  const name = String(body?.name ?? '').trim()
  if (!name)
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  if (name.length < 2) {
    return NextResponse.json(
      { error: 'Workspace name must be at least 2 characters.' },
      { status: 400 },
    )
  }

  const businessModel = normalizeBusinessModel(body?.businessModel)

  let workspace: Awaited<ReturnType<typeof prisma.workspace.create>> | null =
    null
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = getWorkspaceSlugCandidate(name, attempt)
    try {
      workspace = await prisma.workspace.create({
        data: {
          name,
          slug,
          businessName:
            typeof body?.businessName === 'string' && body.businessName.trim()
              ? body.businessName.trim()
              : null,
          industry:
            typeof body?.industry === 'string' && body.industry.trim()
              ? body.industry.trim()
              : null,
          ownerId: profile.id,
          subscriptionId: profile.subscription?.id ?? null,
          ...getWorkspaceBusinessModelDefaults(businessModel),
          members: {
            create: {
              userId: profile.id,
              role: WorkspaceMemberRole.OWNER,
            },
          },
        },
      })
      break
    } catch (error) {
      if (isPrismaUniqueConstraintError(error, 'slug')) continue
      logWorkspaceCreateFailure({ error, businessModel, name, slug })
      return getWorkspaceCreateErrorResponse(error, businessModel)
    }
  }

  if (!workspace) {
    return NextResponse.json(
      { error: 'Could not create a unique workspace URL. Try another name.' },
      { status: 409 },
    )
  }

  // 🔒 AUDIT LOG — WORKSPACE CREATED
  await logAudit({
    workspaceId: workspace.id,
    actorId: profile.id,
    action: 'WORKSPACE_CREATED',
    targetType: 'Workspace',
    targetId: workspace.id,
    meta: { name: workspace.name, slug: workspace.slug },
  })

  await ensureWorkspaceAIProfile(workspace.id, profile.id)

  return NextResponse.json({ ok: true, workspace })
}
