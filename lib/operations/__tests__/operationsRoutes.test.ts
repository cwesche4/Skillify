import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  health: vi.fn(),
  recover: vi.fn(),
}))

vi.mock('@/lib/auth/serviceToken', () => ({
  authenticateServiceToken: mocks.authenticate,
}))
vi.mock('@/lib/operations/simpleAutomationOperations', () => ({
  getSimpleAutomationOperationsHealth: mocks.health,
  recoverTerminalDomainEvent: mocks.recover,
}))

import { GET as getDiagnostics } from '@/app/api/internal/automation-operations/diagnostics/route'
import { POST as recoverEvent } from '@/app/api/internal/domain-events/recover/route'

describe('Automation operations routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.health.mockResolvedValue({ generatedAt: '2026-09-24T00:00:00.000Z' })
    mocks.recover.mockResolvedValue({
      ok: true,
      eventId: 'event-a',
      workspaceId: 'workspace-a',
    })
  })

  it('keeps diagnostics internal and scope-protected', async () => {
    mocks.authenticate.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const rejected = await getDiagnostics(
      new NextRequest(
        'https://skillify.test/api/internal/automation-operations/diagnostics',
      ),
    )
    expect(rejected.status).toBe(401)
    expect(mocks.health).not.toHaveBeenCalled()

    mocks.authenticate.mockResolvedValueOnce({
      ok: true,
      system: 'operations',
      scopes: ['AUTOMATION_OPERATIONS'],
    })
    const accepted = await getDiagnostics(
      new NextRequest(
        'https://skillify.test/api/internal/automation-operations/diagnostics',
      ),
    )
    expect(accepted.status).toBe(200)
    expect(mocks.authenticate).toHaveBeenLastCalledWith(
      expect.anything(),
      'AUTOMATION_OPERATIONS',
    )
  })

  it('requires explicit workspace and event identity for one-event recovery', async () => {
    mocks.authenticate.mockResolvedValue({
      ok: true,
      system: 'operations',
      scopes: ['AUTOMATION_OPERATIONS'],
    })
    const invalid = await recoverEvent(
      new NextRequest(
        'https://skillify.test/api/internal/domain-events/recover',
        { method: 'POST', body: JSON.stringify({ eventId: 'event-a' }) },
      ),
    )
    expect(invalid.status).toBe(400)
    expect(mocks.recover).not.toHaveBeenCalled()

    const accepted = await recoverEvent(
      new NextRequest(
        'https://skillify.test/api/internal/domain-events/recover',
        {
          method: 'POST',
          body: JSON.stringify({
            eventId: 'event-a',
            workspaceId: 'workspace-a',
          }),
        },
      ),
    )
    expect(accepted.status).toBe(200)
    expect(mocks.recover).toHaveBeenCalledWith({
      eventId: 'event-a',
      workspaceId: 'workspace-a',
      operatorSystem: 'operations',
    })
  })
})
