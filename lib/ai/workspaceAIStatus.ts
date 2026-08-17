import {
  WorkspaceAIActivityType,
  WorkspaceAIStatus,
  type WorkspaceAIStatus as WorkspaceAIStatusValue,
} from '@/lib/prisma/enums'

export type WorkspaceAIGuardrails = {
  allowAdvice: boolean
  allowDrafting: boolean
  allowActionProposals: boolean
  requireApprovalForActions: boolean
  allowAutonomousActions: boolean
}

export const DEFAULT_WORKSPACE_AI_GUARDRAILS: WorkspaceAIGuardrails = {
  allowAdvice: true,
  allowDrafting: true,
  allowActionProposals: false,
  requireApprovalForActions: true,
  allowAutonomousActions: false,
}

export const WORKSPACE_AI_STATUS_COPY: Record<WorkspaceAIStatusValue, string> =
  {
    [WorkspaceAIStatus.NOT_CONFIGURED]:
      'Add business context before enabling workspace-aware AI.',
    [WorkspaceAIStatus.READY]:
      'Skillify AI can use the saved business context when you use AI features in this workspace.',
    [WorkspaceAIStatus.PAUSED]:
      'Workspace-aware AI is paused for this workspace.',
    [WorkspaceAIStatus.DISABLED]:
      'Workspace-aware AI is disabled for this workspace.',
  }

export function normalizeWorkspaceAIStatus(
  status: unknown,
): WorkspaceAIStatusValue {
  return typeof status === 'string' && status in WorkspaceAIStatus
    ? (status as WorkspaceAIStatusValue)
    : WorkspaceAIStatus.NOT_CONFIGURED
}

export function getDefaultWorkspaceAIProfileData() {
  return {
    enabled: false,
    status: WorkspaceAIStatus.NOT_CONFIGURED,
    automationGuardrails: DEFAULT_WORKSPACE_AI_GUARDRAILS,
  }
}

export function isWorkspaceAIUsable(params: {
  enabled: boolean
  status: WorkspaceAIStatusValue | string
  archivedAt?: Date | string | null
}) {
  if (params.archivedAt) return false
  return (
    params.enabled === true &&
    normalizeWorkspaceAIStatus(params.status) === WorkspaceAIStatus.READY
  )
}

export { WorkspaceAIActivityType, WorkspaceAIStatus }
