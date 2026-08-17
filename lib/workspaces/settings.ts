import { prisma } from '@/lib/db'

export type WorkspaceSettings = {
  aiActionsEnabled: boolean
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  aiActionsEnabled: false,
}

export async function getWorkspaceSettings(
  workspaceId: string,
): Promise<WorkspaceSettings> {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { workspaceId },
    select: { aiActionsEnabled: true },
  })

  if (!settings) return DEFAULT_SETTINGS
  return settings
}

export async function setWorkspaceAiActionsEnabled(
  workspaceId: string,
  enabled: boolean,
) {
  const settings = await prisma.workspaceSettings.upsert({
    where: { workspaceId },
    update: { aiActionsEnabled: enabled },
    create: { workspaceId, aiActionsEnabled: enabled },
    select: { aiActionsEnabled: true },
  })

  return settings
}
