import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import {
  getCRMActionSLO,
  getCRMCircuitSLO,
  getCRMWebhookSLO,
  getAutomationRunSLO,
} from '@/lib/ops/slo'
import { classifyCRMError } from '@/lib/integrations/failureCategory'
import { WorkspaceMemberRole } from '@prisma/client'

const WINDOW_MS = 24 * 60 * 60 * 1000

async function requireOwnerOrAdmin(workspaceId: string) {
  const { userId } = auth()
  if (!userId) throw new Error('UNAUTH')

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { clerkId: userId } },
    select: { role: true },
  })

  if (
    !membership ||
    (membership.role !== WorkspaceMemberRole.OWNER &&
      membership.role !== WorkspaceMemberRole.ADMIN)
  ) {
    throw new Error('FORBIDDEN')
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const workspaceId = url.searchParams.get('workspaceId')
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId required' },
        { status: 400 },
      )
    }

    try {
      await requireOwnerOrAdmin(workspaceId)
    } catch (err: any) {
      if (err.message === 'UNAUTH') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (err.message === 'FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      throw err
    }

    const since = new Date(Date.now() - WINDOW_MS)

    const [breakerOpened24h, webhook24h, action24h, lastFailureLog] =
      await Promise.all([
        prisma.auditLog.count({
          where: {
            workspaceId,
            action: 'CRM_CIRCUIT_OPENED',
            createdAt: { gte: since },
          },
        }),
        prisma.auditLog.count({
          where: {
            workspaceId,
            action: 'CRM_WEBHOOK_RECEIVED',
            createdAt: { gte: since },
          },
        }),
        prisma.auditLog.count({
          where: {
            workspaceId,
            action: 'CRM_ACTION_EXECUTED',
            createdAt: { gte: since },
          },
        }),
        prisma.auditLog.findFirst({
          where: {
            workspaceId,
            action: {
              in: [
                'CRM_ACTION_FAILED',
                'CRM_WEBHOOK_REJECTED',
                'CRM_EXECUTION_TIMEOUT',
                'CRM_CIRCUIT_OPENED',
              ],
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ])

    let lastFailureCategory: string | null = null
    if (lastFailureLog) {
      const meta = lastFailureLog.meta
      const metaObj =
        meta && typeof meta === 'object' && !Array.isArray(meta)
          ? (meta as Record<string, any>)
          : null
      lastFailureCategory =
        (metaObj?.failureCategory as string | undefined) ||
        classifyCRMError(metaObj?.error ? String(metaObj.error) : undefined) ||
        null
    }

    const [webhookSLO, actionSLO, circuitSLO, automationSLO] =
      await Promise.all([
        getCRMWebhookSLO(workspaceId, since),
        getCRMActionSLO(workspaceId, since),
        getCRMCircuitSLO(workspaceId, since),
        getAutomationRunSLO(workspaceId, since),
      ])

    return NextResponse.json({
      ok: true,
      workspaceId,
      since: since.toISOString(),
      lastFailureCategory,
      counts: {
        breakerOpened24h,
        webhook24h,
        action24h,
      },
      slo: {
        webhook: webhookSLO,
        action: actionSLO,
        circuit: circuitSLO,
        automation: automationSLO,
      },
    })
  } catch (err) {
    console.error('CRM ops export failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
