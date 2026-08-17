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
}))

const mockPrisma = {
  userProfile: {
    findUnique: vi.fn(),
  },
  workspaceMember: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  aiActionAudit: {
    findMany: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

const mockAssertAiActionsEnabled = vi.fn()
vi.mock('@/lib/builder/ai/server/assertAiActionsEnabled', () => ({
  assertAiActionsEnabled: mockAssertAiActionsEnabled,
}))

const mockRateLimit = vi.fn()
vi.mock('@/lib/rate-limit/aiActions', () => ({
  checkAiActionRate: mockRateLimit,
}))

const mockUndo = vi.fn()
const mockComputeHash = vi.fn()
vi.mock('@/lib/builder/ai/server/undo', () => ({
  undoAiAction: mockUndo,
  computeAuditHash: mockComputeHash,
}))

const mockRequireWorkspaceRole = vi.fn()
vi.mock('@/lib/auth/requireWorkspaceRole', () => ({
  requireWorkspaceRole: mockRequireWorkspaceRole,
}))

const mockQueryAudits = vi.fn()
vi.mock('@/lib/builder/ai/server/auditQuery', () => ({
  queryAiActionAudits: mockQueryAudits,
}))

process.env.AI_ACTIONS_GLOBALLY_DISABLED =
  process.env.AI_ACTIONS_GLOBALLY_DISABLED ?? 'false'

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { assertAiActionsEnabled } from '@/lib/builder/ai/server/assertAiActionsEnabled'
import { checkAiActionRate } from '@/lib/rate-limit/aiActions'
import { undoAiAction } from '@/lib/builder/ai/server/undo'
import { requireWorkspaceRole } from '@/lib/auth/requireWorkspaceRole'

import { POST as nodeImprovePost } from '@/app/api/ai/node-improve/route'
import { POST as undoPost } from '@/app/api/workspaces/[workspaceId]/ai-actions/undo/route'
import { GET as auditGet } from '@/app/api/workspaces/[workspaceId]/ai-actions/audit/route'

describe('AI action routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('denies when workspace kill switch is disabled', async () => {
    vi.mocked(auth).mockReturnValue({ userId: 'clerk_1' } as any)
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: 'user1',
    } as any)
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      id: 'wm1',
    } as any)
    vi.mocked(assertAiActionsEnabled).mockResolvedValue(
      new Response(JSON.stringify({ error: 'disabled' }), { status: 403 }),
    )
    vi.mocked(checkAiActionRate).mockReturnValue({ allowed: true } as any)

    const req = new Request('http://localhost/api/ai/node-improve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'ws1',
        automationId: 'auto1',
        nodeId: 'node1',
        type: 'ai-llm',
        data: {},
      }),
    })

    const res = await nodeImprovePost(req as any)
    expect(res.status).toBe(403)
  })

  it('rate limits AI actions', async () => {
    vi.mocked(auth).mockReturnValue({ userId: 'clerk_1' } as any)
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: 'user1',
    } as any)
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      id: 'wm1',
    } as any)
    vi.mocked(assertAiActionsEnabled).mockResolvedValue(null as any)
    vi.mocked(checkAiActionRate).mockReturnValue({
      allowed: false,
      retryAfterMs: 1234,
    } as any)

    const req = new Request('http://localhost/api/ai/node-improve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'ws1',
        automationId: 'auto1',
        nodeId: 'node1',
        type: 'ai-llm',
        data: {},
      }),
    })

    const res = await nodeImprovePost(req as any)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.retryAfterMs).toBe(1234)
  })

  it('rejects undo when conflicts detected', async () => {
    vi.mocked(auth).mockReturnValue({ userId: 'clerk_1' } as any)
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: 'user1',
    } as any)
    vi.mocked(undoAiAction).mockResolvedValue({
      ok: false,
      status: 409,
      error: 'Conflict detected',
    })

    const req = new Request(
      'http://localhost/api/workspaces/ws1/ai-actions/undo',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          automationId: 'auto1',
          nodeId: 'node1',
          currentNodeData: { foo: 'bar' },
        }),
      },
    )

    const res = await undoPost(
      req as any,
      { params: { workspaceId: 'ws1' } } as any,
    )
    expect(res.status).toBe(409)
  })

  it('requires admin access for audit queries', async () => {
    vi.mocked(auth).mockReturnValue({ userId: 'clerk_1' } as any)
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      id: 'user1',
    } as any)
    vi.mocked(requireWorkspaceRole).mockRejectedValue(new Error('Forbidden'))

    const req = new Request(
      'http://localhost/api/workspaces/ws1/ai-actions/audit',
      {
        method: 'GET',
      },
    )

    await expect(
      auditGet(req as any, { params: { workspaceId: 'ws1' } } as any),
    ).rejects.toThrow('Forbidden')
  })
})
