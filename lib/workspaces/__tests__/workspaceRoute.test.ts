import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  },
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  clerkClient: { users: { getUser: vi.fn() } },
}))

const mocks = vi.hoisted(() => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(),
    },
    workspace: {
      create: vi.fn(),
    },
    workspaceMember: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  logAudit: vi.fn(),
  ensureWorkspaceAIProfile: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/lib/audit/log', () => ({
  logAudit: mocks.logAudit,
}))

vi.mock('@/lib/ai/ensureWorkspaceAIProfile', () => ({
  ensureWorkspaceAIProfile: mocks.ensureWorkspaceAIProfile,
}))

import { auth } from '@clerk/nextjs/server'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { POST as createWorkspace } from '@/app/api/workspaces/route'
import { POST as switchWorkspace } from '@/app/api/workspaces/switch/route'

function postWorkspace(body: Record<string, unknown>) {
  return createWorkspace(
    new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

function postWorkspaceSwitch(body: Record<string, unknown> | string) {
  return switchWorkspace(
    new Request('http://localhost/api/workspaces/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

function createdWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    id: 'workspace_1',
    name: 'Lawn Co',
    slug: 'lawn-co',
    businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
    ...overrides,
  }
}

describe('workspace creation route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockReturnValue({ userId: 'clerk_1' } as any)
    mocks.prisma.userProfile.findUnique.mockResolvedValue({
      id: 'user_1',
      subscription: {
        id: 'sub_1',
        status: 'trialing',
        trialEndsAt: new Date('2026-08-27T12:00:00.000Z'),
        complimentaryEndsAt: null,
      },
    })
    mocks.prisma.workspace.create.mockResolvedValue(createdWorkspace())
    mocks.logAudit.mockResolvedValue(undefined)
    mocks.ensureWorkspaceAIProfile.mockResolvedValue(undefined)
  })

  it('persists Service Business with the canonical SIMPLE_SERVICE_BUSINESS value and service defaults', async () => {
    const response = await postWorkspace({
      name: 'Lawn Co',
      businessName: 'Lawn Co LLC',
      industry: 'Lawn care',
      businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
    })

    expect(response.status).toBe(200)
    expect(mocks.prisma.workspace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Lawn Co',
        slug: 'lawn-co',
        businessName: 'Lawn Co LLC',
        industry: 'Lawn care',
        ownerId: 'user_1',
        subscriptionId: 'sub_1',
        businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
        defaultLeadDestination: 'CUSTOMER',
        opportunitiesEnabled: false,
        commerceEnabled: false,
        customerSingularLabel: 'Customer',
        customerPluralLabel: 'Customers',
        salesLabel: 'Sales',
        members: {
          create: {
            userId: 'user_1',
            role: 'OWNER',
          },
        },
      }),
    })
    expect(mocks.ensureWorkspaceAIProfile).toHaveBeenCalledWith(
      'workspace_1',
      'user_1',
    )
  })

  it('creates a clean real workspace without attaching demo or sample-data provisioning', async () => {
    const response = await postWorkspace({
      name: 'Clean Workspace',
      businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
    })

    expect(response.status).toBe(200)
    const createArgs = mocks.prisma.workspace.create.mock.calls[0]?.[0]
    expect(createArgs.data).not.toHaveProperty('demoData')
    expect(createArgs.data).not.toHaveProperty('sampleData')
    expect(createArgs.data).not.toHaveProperty('seedData')
    expect(mocks.logAudit).toHaveBeenCalledTimes(1)
    expect(mocks.ensureWorkspaceAIProfile).toHaveBeenCalledTimes(1)
  })

  it.each([
    WorkspaceBusinessModel.DIRECT_SALES,
    WorkspaceBusinessModel.CONSULTATIVE_SALES,
    WorkspaceBusinessModel.PRODUCT_COMMERCE,
  ])(
    'creates %s workspaces through the same route path',
    async (businessModel) => {
      mocks.prisma.workspace.create.mockResolvedValue(
        createdWorkspace({ businessModel }),
      )

      const response = await postWorkspace({
        name: 'Acme',
        businessModel,
      })

      expect(response.status).toBe(200)
      expect(mocks.prisma.workspace.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ businessModel }),
      })
    },
  )

  it('returns a migration-specific error when the database enum is missing Service Business', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mocks.prisma.workspace.create.mockRejectedValue(
      new Error(
        'invalid input value for enum "WorkspaceBusinessModel": "SIMPLE_SERVICE_BUSINESS"',
      ),
    )

    const response = await postWorkspace({
      name: 'Lawn Co',
      businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
    })
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({
      error:
        'Service Business is not available in this database yet. Run the latest workspace migrations and try again.',
      code: 'WORKSPACE_BUSINESS_MODEL_SCHEMA_NOT_READY',
    })
    expect(consoleError).toHaveBeenCalledWith(
      '[Skillify][workspace-create] failed before workspace commit',
      expect.objectContaining({
        stage: 'prisma.workspace.create',
        condition: 'WORKSPACE_BUSINESS_MODEL_SCHEMA_NOT_READY',
        businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      }),
    )
    expect(mocks.logAudit).not.toHaveBeenCalled()
    expect(mocks.ensureWorkspaceAIProfile).not.toHaveBeenCalled()

    consoleError.mockRestore()
  })
})

describe('workspace switch route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockReturnValue({ userId: 'clerk_1' } as any)
  })

  it('allows an authorized member to select a workspace by id and returns the canonical slug route', async () => {
    mocks.prisma.workspaceMember.findFirst.mockResolvedValue({
      role: 'MEMBER',
      workspace: {
        id: 'workspace_1',
        name: 'Acme',
        slug: 'acme',
        archivedAt: null,
      },
    })

    const response = await postWorkspaceSwitch({ workspaceId: 'workspace_1' })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: {
        user: { clerkId: 'clerk_1' },
        workspace: { id: 'workspace_1' },
      },
      select: expect.any(Object),
    })
    expect(body).toEqual({
      ok: true,
      redirectTo: '/dashboard/acme',
      workspace: {
        id: 'workspace_1',
        slug: 'acme',
        name: 'Acme',
        role: 'MEMBER',
      },
    })
  })

  it('resolves a selected workspace by slug without requiring optional setup configuration', async () => {
    mocks.prisma.workspaceMember.findFirst.mockResolvedValue({
      role: 'OWNER',
      workspace: {
        id: 'workspace_existing',
        name: 'Existing Workspace',
        slug: 'existing-workspace',
        archivedAt: null,
      },
    })

    const response = await postWorkspaceSwitch({
      workspaceSlug: 'existing-workspace',
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: {
        user: { clerkId: 'clerk_1' },
        workspace: { slug: 'existing-workspace' },
      },
      select: expect.any(Object),
    })
    expect(body.redirectTo).toBe('/dashboard/existing-workspace')
  })

  it('requires id and slug to resolve to the same authorized workspace when both are provided', async () => {
    mocks.prisma.workspaceMember.findFirst.mockResolvedValue({
      role: 'ADMIN',
      workspace: {
        id: 'workspace_1',
        name: 'Acme',
        slug: 'acme',
        archivedAt: null,
      },
    })

    await postWorkspaceSwitch({
      workspaceId: 'workspace_1',
      workspaceSlug: 'acme',
    })

    expect(mocks.prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: {
        user: { clerkId: 'clerk_1' },
        workspace: { id: 'workspace_1', slug: 'acme' },
      },
      select: expect.any(Object),
    })
  })

  it('rejects workspace selection for a non-member', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.prisma.workspaceMember.findFirst.mockResolvedValue(null)

    const response = await postWorkspaceSwitch({ workspaceId: 'workspace_2' })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({
      error: 'You do not have access to that workspace.',
      code: 'WORKSPACE_ACCESS_DENIED',
    })
    warn.mockRestore()
  })

  it('returns a visible request error for malformed switch payloads', async () => {
    const response = await postWorkspaceSwitch({})
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({
      error: 'Choose a workspace to continue.',
      code: 'WORKSPACE_REQUIRED',
    })
    expect(mocks.prisma.workspaceMember.findFirst).not.toHaveBeenCalled()
  })

  it('rejects archived workspace selection without opening the dashboard', async () => {
    mocks.prisma.workspaceMember.findFirst.mockResolvedValue({
      role: 'OWNER',
      workspace: {
        id: 'workspace_1',
        name: 'Acme',
        slug: 'acme',
        archivedAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    })

    const response = await postWorkspaceSwitch({ workspaceId: 'workspace_1' })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toEqual({
      error: 'That workspace is archived and cannot be opened.',
      code: 'WORKSPACE_ARCHIVED',
    })
  })
})
