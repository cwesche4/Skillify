import { beforeEach, describe, expect, it, vi } from 'vitest'

const authorizeAutomationAccessMock = vi.hoisted(() => vi.fn())
const authorizeWorkspaceAccessMock = vi.hoisted(() => vi.fn())
const runAutomationMock = vi.hoisted(() => vi.fn())
const executeAutomationLiveMock = vi.hoisted(() => vi.fn())
const authMock = vi.hoisted(() => vi.fn())
const userProfileFindUniqueMock = vi.hoisted(() => vi.fn())
const automationCreateMock = vi.hoisted(() => vi.fn())
const workspaceFindUniqueMock = vi.hoisted(() => vi.fn())

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }))

vi.mock('@/lib/automations/authorization', () => ({
  authorizeAutomationAccess: authorizeAutomationAccessMock,
  authorizeWorkspaceAccess: authorizeWorkspaceAccessMock,
}))
vi.mock('@/lib/automations/executor', () => ({
  runAutomation: runAutomationMock,
  executeAutomationLive: executeAutomationLiveMock,
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: { findUnique: userProfileFindUniqueMock },
    automation: { create: automationCreateMock },
    workspace: { findUnique: workspaceFindUniqueMock },
  },
}))

import { POST as createAutomationRoute } from '@/app/api/automations/route'
import {
  DELETE as deleteAutomationRoute,
  PATCH as updateAutomationRoute,
} from '@/app/api/automations/[automationId]/route'
import { PUT as updateAutomationFlowRoute } from '@/app/api/automations/[automationId]/flow/route'
import { POST as runAutomationRoute } from '@/app/api/automations/[automationId]/run/route'
import { GET as runAutomationLiveRoute } from '@/app/api/automations/[automationId]/run/live/route'
import { GET as listTemplatesRoute } from '@/app/api/automations/templates/route'
import { POST as createWorkspaceAutomationRoute } from '@/app/api/workspaces/[workspaceId]/automations/route'
import {
  DELETE as deleteWorkspaceAutomationRoute,
  PATCH as renameWorkspaceAutomationRoute,
} from '@/app/api/workspaces/[workspaceId]/automations/[automationId]/route'

describe('managed Simple Automation route ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockReturnValue({ userId: 'clerk-owner' })
    userProfileFindUniqueMock.mockResolvedValue({ id: 'owner-1' })
    workspaceFindUniqueMock.mockResolvedValue({ id: 'workspace-1' })
    authorizeWorkspaceAccessMock.mockResolvedValue({
      allowed: true,
      userProfileId: 'owner-1',
      role: 'OWNER',
    })
    authorizeAutomationAccessMock.mockResolvedValue({
      allowed: true,
      userId: 'clerk-owner',
      userProfileId: 'owner-1',
      role: 'OWNER',
      automation: {
        id: 'automation-1',
        workspaceId: 'workspace-1',
        managedBySimple: true,
      },
    })
  })

  it('blocks the generic run API before executing a managed workflow', async () => {
    const response = await runAutomationRoute(
      new Request('https://skillify.test/api/automations/automation-1/run', {
        method: 'POST',
        body: '{}',
      }),
      { params: { automationId: 'automation-1' } },
    )

    expect(response.status).toBe(409)
    expect(runAutomationMock).not.toHaveBeenCalled()
  })

  it('blocks the Advanced live-run API before creating run history', async () => {
    const response = await runAutomationLiveRoute(
      new Request(
        'https://skillify.test/api/automations/automation-1/run/live',
      ),
      { params: { automationId: 'automation-1' } },
    )

    expect(response.status).toBe(409)
    expect(executeAutomationLiveMock).not.toHaveBeenCalled()
  })

  it('blocks every generic mutation surface for a Simple-managed workflow', async () => {
    const context = { params: { automationId: 'automation-1' } }
    const workspaceContext = {
      params: { workspaceId: 'workspace-1', automationId: 'automation-1' },
    }

    const flow = await updateAutomationFlowRoute(
      new Request('https://skillify.test/api/automations/automation-1/flow', {
        method: 'PUT',
        body: JSON.stringify({ nodes: [], edges: [] }),
      }),
      context,
    )
    const update = await updateAutomationRoute(
      new Request('https://skillify.test/api/automations/automation-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Mutated' }),
      }),
      context,
    )
    const remove = await deleteAutomationRoute(
      new Request('https://skillify.test/api/automations/automation-1', {
        method: 'DELETE',
      }),
      context,
    )
    const rename = await renameWorkspaceAutomationRoute(
      new Request(
        'https://skillify.test/api/workspaces/workspace-1/automations/automation-1',
        { method: 'PATCH', body: JSON.stringify({ name: 'Mutated' }) },
      ),
      workspaceContext,
    )
    const workspaceRemove = await deleteWorkspaceAutomationRoute(
      new Request(
        'https://skillify.test/api/workspaces/workspace-1/automations/automation-1',
        { method: 'DELETE' },
      ),
      workspaceContext,
    )

    expect([
      flow.status,
      update.status,
      remove.status,
      rename.status,
      workspaceRemove.status,
    ]).toEqual([409, 409, 409, 409, 409])
  })

  it('blocks direct Advanced creation, activation, templates, and execution', async () => {
    authorizeAutomationAccessMock.mockResolvedValue({
      allowed: true,
      userId: 'clerk-owner',
      userProfileId: 'owner-1',
      role: 'OWNER',
      automation: {
        id: 'automation-advanced',
        workspaceId: 'workspace-1',
        managedBySimple: false,
      },
    })

    const create = await createAutomationRoute(
      new Request('https://skillify.test/api/automations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Unsupported workflow',
          workspaceId: 'workspace-1',
        }),
      }),
    )
    const workspaceCreate = await createWorkspaceAutomationRoute(
      new Request(
        'https://skillify.test/api/workspaces/workspace-1/automations',
        {
          method: 'POST',
          body: JSON.stringify({ name: 'Unsupported workflow' }),
        },
      ),
      { params: { workspaceId: 'workspace-1' } },
    )
    const activate = await updateAutomationRoute(
      new Request('https://skillify.test/api/automations/automation-advanced', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACTIVE' }),
      }),
      { params: { automationId: 'automation-advanced' } },
    )
    const flow = await updateAutomationFlowRoute(
      new Request(
        'https://skillify.test/api/automations/automation-advanced/flow',
        {
          method: 'PUT',
          body: JSON.stringify({ nodes: [], edges: [] }),
        },
      ),
      { params: { automationId: 'automation-advanced' } },
    )
    const remove = await deleteAutomationRoute(
      new Request('https://skillify.test/api/automations/automation-advanced', {
        method: 'DELETE',
      }),
      { params: { automationId: 'automation-advanced' } },
    )
    const run = await runAutomationRoute(
      new Request(
        'https://skillify.test/api/automations/automation-advanced/run',
        { method: 'POST', body: '{}' },
      ),
      { params: { automationId: 'automation-advanced' } },
    )
    const templates = await listTemplatesRoute(
      new Request(
        'https://skillify.test/api/automations/templates?workspaceSlug=acme',
      ),
    )

    expect(create.status).toBe(409)
    expect(workspaceCreate.status).toBe(409)
    expect(activate.status).toBe(409)
    expect(flow.status).toBe(409)
    expect(remove.status).toBe(409)
    expect(run.status).toBe(409)
    expect(templates.status).toBe(409)
    expect(automationCreateMock).not.toHaveBeenCalled()
    expect(runAutomationMock).not.toHaveBeenCalled()
  })
})
