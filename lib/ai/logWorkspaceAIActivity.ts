import { prisma } from '@/lib/db'
import {
  WorkspaceAIActivityType,
  type WorkspaceAIActivityType as WorkspaceAIActivityTypeValue,
} from '@/lib/prisma/enums'

export type LogWorkspaceAIActivityInput = {
  workspaceId: string
  userId?: string | null
  type: WorkspaceAIActivityTypeValue
  source?: string | null
  metadata?: Record<string, unknown> | null
}

export async function logWorkspaceAIActivity({
  workspaceId,
  userId,
  type,
  source,
  metadata,
}: LogWorkspaceAIActivityInput) {
  const activity = (prisma as any).workspaceAIActivity
  if (!activity?.create) return null

  return activity.create({
    data: {
      workspaceId,
      userId: userId ?? null,
      type,
      source: source ?? null,
      metadata: metadata ?? {},
    },
  })
}

export { WorkspaceAIActivityType }
