import { auth } from '@clerk/nextjs/server'

import {
  canManageAutomations,
  canViewAutomations,
} from '@/lib/automations/policy'

type AccessLevel = 'view' | 'manage'

type AutomationScope = {
  id: string
  workspaceId: string
  managedBySimple?: boolean
}

type WorkspaceMembership = {
  id?: string
  userId: string
  role: string
}

export function buildAutomationRunScope(input: {
  runId: string
  automationId: string
  workspaceId: string
}) {
  return {
    id: input.runId,
    automationId: input.automationId,
    workspaceId: input.workspaceId,
  }
}

export type AutomationAuthorizationDependencies = {
  getUserId: () => Promise<string | null>
  findAutomation: (input: {
    automationId: string
    workspaceId?: string
  }) => Promise<AutomationScope | null>
  findMembership: (input: {
    clerkId: string
    workspaceId: string
  }) => Promise<WorkspaceMembership | null>
}

const defaultDependencies: AutomationAuthorizationDependencies = {
  async getUserId() {
    const { userId } = await auth()
    return userId
  },
  async findAutomation({ automationId, workspaceId }) {
    const { prisma } = await import('@/lib/db')
    const automation = await prisma.automation.findFirst({
      where: {
        id: automationId,
        workspaceId: workspaceId ?? undefined,
      },
      select: {
        id: true,
        workspaceId: true,
        simpleAutomationInstallation: { select: { id: true } },
      },
    })
    if (!automation) return null
    return {
      id: automation.id,
      workspaceId: automation.workspaceId,
      managedBySimple: Boolean(automation.simpleAutomationInstallation),
    }
  },
  async findMembership({ clerkId, workspaceId }) {
    const { prisma } = await import('@/lib/db')
    return prisma.workspaceMember.findFirst({
      where: { workspaceId, user: { clerkId } },
      select: { id: true, userId: true, role: true },
    })
  },
}

export type AutomationAuthorizationResult =
  | {
      allowed: true
      userId: string
      userProfileId: string
      role: string
      automation: AutomationScope
    }
  | { allowed: false; status: 401 | 403 | 404; message: string }

export async function authorizeAutomationAccess(
  input: {
    automationId: string
    workspaceId?: string
    access: AccessLevel
  },
  dependencies: AutomationAuthorizationDependencies = defaultDependencies,
): Promise<AutomationAuthorizationResult> {
  const userId = await dependencies.getUserId()
  if (!userId) {
    return { allowed: false, status: 401, message: 'Unauthorized' }
  }

  const automation = await dependencies.findAutomation({
    automationId: input.automationId,
    workspaceId: input.workspaceId,
  })
  if (!automation) {
    return { allowed: false, status: 404, message: 'Automation not found' }
  }

  const membership = await dependencies.findMembership({
    clerkId: userId,
    workspaceId: automation.workspaceId,
  })
  if (!membership || !canViewAutomations(membership.role)) {
    // Hide records in other workspaces from authenticated callers.
    return { allowed: false, status: 404, message: 'Automation not found' }
  }
  if (input.access === 'manage' && !canManageAutomations(membership.role)) {
    return { allowed: false, status: 403, message: 'Forbidden' }
  }

  return {
    allowed: true,
    userId,
    userProfileId: membership.userId,
    role: membership.role,
    automation,
  }
}

export type WorkspaceAuthorizationResult =
  | {
      allowed: true
      userId: string
      userProfileId: string
      role: string
      workspaceId: string
      workspaceMemberId: string | null
    }
  | { allowed: false; status: 401 | 403; message: string }

export async function authorizeWorkspaceAccess(
  input: { workspaceId: string; access: AccessLevel },
  dependencies: Pick<
    AutomationAuthorizationDependencies,
    'getUserId' | 'findMembership'
  > = defaultDependencies,
): Promise<WorkspaceAuthorizationResult> {
  const userId = await dependencies.getUserId()
  if (!userId) {
    return { allowed: false, status: 401, message: 'Unauthorized' }
  }

  const membership = await dependencies.findMembership({
    clerkId: userId,
    workspaceId: input.workspaceId,
  })
  if (!membership || !canViewAutomations(membership.role)) {
    return { allowed: false, status: 403, message: 'Forbidden' }
  }
  if (input.access === 'manage' && !canManageAutomations(membership.role)) {
    return { allowed: false, status: 403, message: 'Forbidden' }
  }

  return {
    allowed: true,
    userId,
    userProfileId: membership.userId,
    role: membership.role,
    workspaceId: input.workspaceId,
    workspaceMemberId: membership.id ?? null,
  }
}
