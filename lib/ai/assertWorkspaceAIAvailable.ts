import { getWorkspaceAIContext } from '@/lib/ai/getWorkspaceAIContext'

export async function assertWorkspaceAIAvailable(input: {
  workspaceId: string
  userId: string
  purpose?: string
}) {
  const context = await getWorkspaceAIContext(input)

  if (!context.capabilities.canUseAI) {
    throw new Error('Workspace AI is not available for this workspace.')
  }

  return context
}
