import { prisma } from '@/lib/db'

type SLOStatus = {
  value: number
  threshold: number
  within: boolean
}

// CRM Webhook Availability: 99.9% (1 - rejected/received)
export async function getCRMWebhookSLO(
  workspaceId: string,
  since: Date,
): Promise<SLOStatus> {
  const [received, rejected] = await Promise.all([
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
        action: 'CRM_WEBHOOK_REJECTED',
        createdAt: { gte: since },
      },
    }),
  ])
  const total = received + rejected
  const availability = total === 0 ? 1 : received / total
  const threshold = 0.999
  return { value: availability, threshold, within: availability >= threshold }
}

// CRM Action Success: >= 99% success; timeout rate <= 0.5%
export async function getCRMActionSLO(
  workspaceId: string,
  since: Date,
): Promise<{
  success: SLOStatus
  timeout: SLOStatus
}> {
  const [executed, failed, timeouts] = await Promise.all([
    prisma.auditLog.count({
      where: {
        workspaceId,
        action: 'CRM_ACTION_EXECUTED',
        createdAt: { gte: since },
      },
    }),
    prisma.auditLog.count({
      where: {
        workspaceId,
        action: 'CRM_ACTION_FAILED',
        createdAt: { gte: since },
      },
    }),
    prisma.auditLog.count({
      where: {
        workspaceId,
        action: 'CRM_EXECUTION_TIMEOUT',
        createdAt: { gte: since },
      },
    }),
  ])
  const total = executed + failed + timeouts
  const successRate = total === 0 ? 1 : executed / total
  const timeoutRate = total === 0 ? 0 : timeouts / total
  return {
    success: {
      value: successRate,
      threshold: 0.99,
      within: successRate >= 0.99,
    },
    timeout: {
      value: timeoutRate,
      threshold: 0.005,
      within: timeoutRate <= 0.005,
    },
  }
}

// Circuit opens per 24h: < 3
export async function getCRMCircuitSLO(
  workspaceId: string,
  since: Date,
): Promise<SLOStatus> {
  const opened = await prisma.auditLog.count({
    where: {
      workspaceId,
      action: 'CRM_CIRCUIT_OPENED',
      createdAt: { gte: since },
    },
  })
  const threshold = 3
  const within = opened < threshold
  return { value: opened, threshold, within }
}

// Automation completion: ≥ 98%; guardrail hits < 0.1%
export async function getAutomationRunSLO(
  workspaceId: string,
  since: Date,
): Promise<{
  completion: SLOStatus
  guardDepth: SLOStatus
  guardNodes: SLOStatus
}> {
  const [success, failed, guardDepth, guardNodes] = await Promise.all([
    prisma.auditLog.count({
      where: {
        workspaceId,
        action: 'AUTOMATION_COMPLETED',
        createdAt: { gte: since },
      },
    }),
    prisma.auditLog.count({
      where: {
        workspaceId,
        action: 'AUTOMATION_FAILED',
        createdAt: { gte: since },
      },
    }),
    prisma.auditLog.count({
      where: {
        workspaceId,
        action: 'AUTOMATION_GUARD_DEPTH',
        createdAt: { gte: since },
      },
    }),
    prisma.auditLog.count({
      where: {
        workspaceId,
        action: 'AUTOMATION_GUARD_NODES',
        createdAt: { gte: since },
      },
    }),
  ])
  const total = success + failed
  const completionRate = total === 0 ? 1 : success / total
  const totalGuards = total === 0 ? 1 : total // avoid div by zero; treat as healthy if none
  const depthRate = guardDepth / totalGuards
  const nodeRate = guardNodes / totalGuards
  return {
    completion: {
      value: completionRate,
      threshold: 0.98,
      within: completionRate >= 0.98,
    },
    guardDepth: {
      value: depthRate,
      threshold: 0.001,
      within: depthRate <= 0.001,
    },
    guardNodes: {
      value: nodeRate,
      threshold: 0.001,
      within: nodeRate <= 0.001,
    },
  }
}
