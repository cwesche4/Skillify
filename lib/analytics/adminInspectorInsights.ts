import { PrismaClient } from '@prisma/client'

import { featureFlags } from '@/lib/config/featureFlags'

type AggregateInput = {
  orgWorkspaceIds: string[]
  prisma?: PrismaClient
}

type AdminInsight = {
  totalInspectorUsage: number
  aiAdoptionCount: number
  validationFailures: number
  presetUsage: number
}

/**
 * Computes org-level Inspector insights using pre-aggregated telemetry only.
 * Org workspaces must be explicitly provided and access-gated by callers.
 */
export async function getAdminInspectorInsights({
  orgWorkspaceIds,
  prisma: prismaClient,
}: AggregateInput): Promise<AdminInsight> {
  // If analytics UI/rollups are disabled, return zeros.
  if (!featureFlags.analyticsUI) {
    return {
      totalInspectorUsage: 0,
      aiAdoptionCount: 0,
      validationFailures: 0,
      presetUsage: 0,
    }
  }

  if (!orgWorkspaceIds.length) {
    return {
      totalInspectorUsage: 0,
      aiAdoptionCount: 0,
      validationFailures: 0,
      presetUsage: 0,
    }
  }

  const prisma = prismaClient || (await import('@/lib/db')).prisma
  const client = prisma as any // TODO: remove cast after regenerating Prisma client

  // Uses pre-aggregated inspectorTelemetryAggregate table (kind column) only.
  const aggregates =
    (await client.inspectorTelemetryAggregate.findMany({
      where: { workspaceId: { in: orgWorkspaceIds } },
      select: { kind: true, payload: true },
    })) || []

  let totalInspectorUsage = 0
  let aiAdoptionCount = 0
  let validationFailures = 0
  let presetUsage = 0

  for (const row of aggregates) {
    const payload = row.payload || {}
    switch (row.kind) {
      case 'lifecycle':
        totalInspectorUsage += Number(payload.count || 0)
        break
      case 'ai':
        aiAdoptionCount += Number(payload.count || 0)
        break
      case 'validation':
        validationFailures += Number(payload.failed || 0)
        break
      case 'presets':
        presetUsage += Number(payload.count || 0)
        break
      default:
        break
    }
  }

  return {
    totalInspectorUsage,
    aiAdoptionCount,
    validationFailures,
    presetUsage,
  }
}
