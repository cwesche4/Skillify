import { prisma } from '@/lib/db'
import { WorkspaceAIActivityType } from '@/lib/prisma/enums'
import { getDefaultWorkspaceAIProfileData } from '@/lib/ai/workspaceAIStatus'
import { logWorkspaceAIActivity } from '@/lib/ai/logWorkspaceAIActivity'

export async function ensureWorkspaceAIProfile(
  workspaceId: string,
  userId?: string | null,
) {
  const workspaceAIProfile = (prisma as any).workspaceAIProfile
  if (!workspaceAIProfile) return null

  if (workspaceAIProfile.findUnique) {
    const existingProfile = await workspaceAIProfile.findUnique({
      where: { workspaceId },
    })
    if (existingProfile) return existingProfile
  }

  if (workspaceAIProfile.create) {
    const profile = await workspaceAIProfile.create({
      data: {
        workspaceId,
        ...getDefaultWorkspaceAIProfileData(),
      },
    })

    await logWorkspaceAIActivity({
      workspaceId,
      userId,
      type: WorkspaceAIActivityType.PROFILE_CREATED,
      source: 'workspace.lifecycle',
    })

    return profile
  }

  if (!workspaceAIProfile.upsert) return null

  const profile = await workspaceAIProfile.upsert({
    where: { workspaceId },
    update: {},
    create: {
      workspaceId,
      ...getDefaultWorkspaceAIProfileData(),
    },
  })

  return profile
}
