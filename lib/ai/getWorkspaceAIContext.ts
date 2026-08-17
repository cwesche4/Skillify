import { prisma } from '@/lib/db'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { WorkspaceAIStatus } from '@/lib/prisma/enums'
import {
  DEFAULT_WORKSPACE_AI_GUARDRAILS,
  isWorkspaceAIUsable,
} from '@/lib/ai/workspaceAIStatus'
import { COMMERCE_MODULES } from '@/lib/commerce/commerceRegistry'

export type GetWorkspaceAIContextInput = {
  workspaceId: string
  userId: string
  purpose?: string
}

export type WorkspaceAIContext = {
  workspace: {
    id: string
    name: string
    businessName?: string | null
    industry?: string | null
    businessModel: string
    terminology: Record<string, string>
    commerce?: {
      enabled: boolean
      enabledModules: string[]
      lifecycle: string
    }
  }
  aiProfile: {
    enabled: boolean
    status: string
    businessSummary?: string | null
    productsAndServices?: unknown
    operatingGuidelines?: unknown
    brandVoice?: unknown
    customerPolicies?: unknown
    automationGuardrails?: unknown
  }
  actor: {
    userId: string
    workspaceRole: string
  }
  capabilities: {
    canUseAI: boolean
    canRequestAdvice: boolean
    canDraftContent: boolean
    canProposeActions: boolean
    canExecuteActions: boolean
  }
}

export async function getWorkspaceAIContext({
  workspaceId,
  userId,
}: GetWorkspaceAIContextInput): Promise<WorkspaceAIContext> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        where: { userId },
        select: { role: true, userId: true },
      },
      aiProfile: true,
    },
  })

  if (!workspace) {
    throw new Error('Workspace not found')
  }

  const membership = workspace.members[0]
  if (!membership) {
    throw new Error('Workspace access denied')
  }

  const aiProfile =
    workspace.aiProfile ??
    ({
      enabled: false,
      status: WorkspaceAIStatus.NOT_CONFIGURED,
      businessSummary: null,
      productsAndServices: null,
      operatingGuidelines: null,
      brandVoice: null,
      customerPolicies: null,
      automationGuardrails: DEFAULT_WORKSPACE_AI_GUARDRAILS,
    } as const)

  const guardrails =
    typeof aiProfile.automationGuardrails === 'object' &&
    aiProfile.automationGuardrails !== null
      ? {
          ...DEFAULT_WORKSPACE_AI_GUARDRAILS,
          ...(aiProfile.automationGuardrails as Record<string, unknown>),
        }
      : DEFAULT_WORKSPACE_AI_GUARDRAILS

  const canUseAI = isWorkspaceAIUsable({
    enabled: aiProfile.enabled,
    status: aiProfile.status,
    archivedAt: workspace.archivedAt,
  })

  const workspaceCapabilities = getWorkspaceCapabilities(workspace as any)

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      businessName: workspace.businessName,
      industry: workspace.industry,
      businessModel: workspace.businessModel,
      terminology: {
        customerSingular: workspaceCapabilities.terminology.customerSingular,
        customerPlural: workspaceCapabilities.terminology.customerPlural,
        salesLabel: workspaceCapabilities.terminology.salesLabel,
      },
      commerce: {
        enabled: workspaceCapabilities.commerce.commerceEnabled,
        enabledModules: COMMERCE_MODULES.filter(
          (module) => workspaceCapabilities.modules[module.capability],
        ).map((module) => module.id),
        lifecycle: workspaceCapabilities.commerce.commerceEnabled
          ? 'Customer -> Order -> Fulfillment'
          : 'Service CRM',
      },
    },
    aiProfile: {
      enabled: aiProfile.enabled,
      status: aiProfile.status,
      businessSummary: aiProfile.businessSummary,
      productsAndServices: aiProfile.productsAndServices,
      operatingGuidelines: aiProfile.operatingGuidelines,
      brandVoice: aiProfile.brandVoice,
      customerPolicies: aiProfile.customerPolicies,
      automationGuardrails: guardrails,
    },
    actor: {
      userId: membership.userId,
      workspaceRole: membership.role,
    },
    capabilities: {
      canUseAI,
      canRequestAdvice: canUseAI && guardrails.allowAdvice === true,
      canDraftContent: canUseAI && guardrails.allowDrafting === true,
      canProposeActions: canUseAI && guardrails.allowActionProposals === true,
      canExecuteActions: false,
    },
  }
}
