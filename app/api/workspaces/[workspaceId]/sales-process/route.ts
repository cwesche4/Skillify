import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import {
  LeadConversionDestination,
  QualifiedLeadBehavior,
  WorkspaceBusinessModel,
} from '@/lib/prisma/enums'
import { getWorkspaceBusinessModelDefaults } from '@/lib/workspaces/businessModelRegistry'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { normalizeSalesProcessConfig } from '@/lib/workspaces/normalizeSalesProcessConfig'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function isAdminRole(role?: string | null) {
  return role === 'OWNER' || role === 'ADMIN'
}

function normalizeBusinessModel(value: unknown) {
  return typeof value === 'string' && value in WorkspaceBusinessModel
    ? (value as keyof typeof WorkspaceBusinessModel)
    : null
}

function normalizeDestination(value: unknown) {
  return typeof value === 'string' && value in LeadConversionDestination
    ? (value as keyof typeof LeadConversionDestination)
    : null
}

function normalizeQualifiedLeadBehavior(value: unknown) {
  return typeof value === 'string' && value in QualifiedLeadBehavior
    ? (value as keyof typeof QualifiedLeadBehavior)
    : null
}

async function loadWorkspaceForAdmin(workspaceId: string, clerkId: string) {
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!profile) return null

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        where: { userId: profile.id },
        select: { role: true },
      },
    },
  })
  const role = workspace?.members[0]?.role
  if (!workspace || !isAdminRole(role)) return null
  return workspace
}

export async function PATCH(
  request: Request,
  { params }: { params: { workspaceId: string } },
) {
  const { userId } = auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspace = await loadWorkspaceForAdmin(params.workspaceId, userId)
  if (!workspace) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const model = normalizeBusinessModel(body.businessModel)
  const defaults = model
    ? getWorkspaceBusinessModelDefaults(model)
    : ({} as Partial<ReturnType<typeof getWorkspaceBusinessModelDefaults>>)
  const opportunitiesEnabled =
    typeof body.opportunitiesEnabled === 'boolean'
      ? body.opportunitiesEnabled
      : defaults.opportunitiesEnabled
  const commerceEnabled =
    typeof body.commerceEnabled === 'boolean'
      ? body.commerceEnabled
      : defaults.commerceEnabled
  const requestedDestination = normalizeDestination(body.defaultLeadDestination)
  const qualifiedLeadBehavior = normalizeQualifiedLeadBehavior(
    body.qualifiedLeadBehavior,
  )

  const data = {
    ...defaults,
    ...(typeof opportunitiesEnabled === 'boolean'
      ? { opportunitiesEnabled }
      : {}),
    ...(typeof commerceEnabled === 'boolean' ? { commerceEnabled } : {}),
    ...(requestedDestination
      ? { defaultLeadDestination: requestedDestination }
      : {}),
    ...(typeof body.allowDirectLeadToSale === 'boolean'
      ? { allowDirectLeadToSale: body.allowDirectLeadToSale }
      : {}),
    ...(qualifiedLeadBehavior ? { qualifiedLeadBehavior } : {}),
    ...(typeof body.customerSingularLabel === 'string'
      ? { customerSingularLabel: body.customerSingularLabel.trim() || 'Client' }
      : {}),
    ...(typeof body.customerPluralLabel === 'string'
      ? { customerPluralLabel: body.customerPluralLabel.trim() || 'Clients' }
      : {}),
    ...(typeof body.salesLabel === 'string'
      ? { salesLabel: body.salesLabel.trim() || 'Sales' }
      : {}),
  }
  const normalizedData = normalizeSalesProcessConfig({
    ...workspace,
    ...data,
  })
  if (normalizedData.defaultLeadDestination) {
    data.defaultLeadDestination =
      normalizedData.defaultLeadDestination as LeadConversionDestination
  }

  const updated = await (prisma.workspace as any).update({
    where: { id: workspace.id },
    data,
  })

  return NextResponse.json({
    workspace: updated,
    capabilities: getWorkspaceCapabilities(updated),
  })
}
