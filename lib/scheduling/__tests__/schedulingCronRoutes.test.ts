import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  diagnostics: vi.fn(),
  outbox: vi.fn(),
  reminders: vi.fn(),
  deliveries: vi.fn(),
  recovery: vi.fn(),
}))

vi.mock('@/lib/scheduling/notifications/notificationService', () => ({
  getSchedulingNotificationWorkerDiagnostics: mocks.diagnostics,
  processSchedulingNotificationOutbox: mocks.outbox,
  processDueSchedulingReminders: mocks.reminders,
  processPendingNotificationDeliveries: mocks.deliveries,
  recoverSchedulingNotificationWorkerLeases: mocks.recovery,
}))

import { GET as runNotifications } from '@/app/api/internal/scheduling/notifications/route'
import { GET as runRecovery } from '@/app/api/internal/scheduling/notifications/recovery/route'

describe('Scheduling Vercel cron routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    mocks.outbox.mockResolvedValue({ processed: 0 })
    mocks.reminders.mockResolvedValue({ processed: 0 })
    mocks.deliveries.mockResolvedValue({ processed: 0 })
    mocks.diagnostics.mockResolvedValue({ outboxPending: 0 })
    mocks.recovery.mockResolvedValue({
      recoveredOutbox: 0,
      recoveredReminders: 0,
      recoveredDeliveries: 0,
    })
  })

  it('protects and accepts the combined one-minute worker', async () => {
    const url = 'https://skillify.test/api/internal/scheduling/notifications'
    expect(await runNotifications(new NextRequest(url))).toMatchObject({
      status: 401,
    })
    const response = await runNotifications(
      new NextRequest(url, {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    )
    expect(response.status).toBe(200)
    expect(mocks.outbox).toHaveBeenCalledOnce()
    expect(mocks.reminders).toHaveBeenCalledOnce()
    expect(mocks.deliveries).toHaveBeenCalledOnce()
  })

  it('protects and accepts the five-minute recovery worker', async () => {
    const url =
      'https://skillify.test/api/internal/scheduling/notifications/recovery'
    expect(await runRecovery(new NextRequest(url))).toMatchObject({
      status: 401,
    })
    const response = await runRecovery(
      new NextRequest(url, {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    )
    expect(response.status).toBe(200)
    expect(mocks.recovery).toHaveBeenCalledOnce()
    expect(mocks.diagnostics).toHaveBeenCalledTimes(2)
  })
})
