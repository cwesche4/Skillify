// lib/automations/executor.ts

import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'
import { ensureIntegrationAdapters } from '@/lib/integrations/register-default'
import { getIntegrationAdapter } from '@/lib/integrations/registry'
import type { IntegrationProvider, IntegrationActionResult } from '@/lib/integrations/types'
import { upsertExternalRecord } from '@/lib/integrations/externalRecords'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'
import { decryptToken } from '@/lib/integrations/crypto'
import { recordFailure, resetBreakerIfNeeded, isBreakerOpen } from '@/lib/integrations/circuit'
import { normalizeCRMAuditMeta } from '@/lib/integrations/auditMeta'
import { classifyCRMError } from '@/lib/integrations/failureCategory'
import { shouldDeferCRMAction, buildDeferMeta } from '@/lib/integrations/defer'
import { classifyFailureSource } from '@/lib/automations/failureAttribution'
// Debug flag (env); default off. Never include raw CRM payloads.
const DEBUG_MODE = process.env.AUTOMATION_DEBUG_MODE === 'true'
import { classifyAutomationFailureSource } from '@/lib/automations/failure'

ensureIntegrationAdapters()

/* ------------------------------ Local Enums (Prisma 7) ------------------------------ */

export type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'
export type AutomationStatus = 'INACTIVE' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'

/* ------------------------------ Types ------------------------------ */

export type FlowNode = {
  id: string
  type?: string
  data?: Record<string, any>
}

export type FlowEdge = {
  id: string
  source: string
  target: string
}

export type FlowGraph = {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

interface RunOptions {
  triggerPayload?: any
  userProfileId?: string | null
}

export interface NodeExecutionContext {
  triggerPayload?: any
  workspaceId?: string
  automationId?: string
  userProfileId?: string | null
  depth: number
}

export interface NodeExecutionResult {
  output: Record<string, any>
  log: string
}

// Per-run CRM action soft cap tracker (keyed by automationId)
const actionCounts: Record<string, number> = {}

/* ------------------------------ Graph Helpers ------------------------------ */

function findStartNodes(flow: FlowGraph): FlowNode[] {
  const targets = new Set(flow.edges.map((e) => e.target))
  return flow.nodes.filter((n) => !targets.has(n.id))
}

function nextNodes(flow: FlowGraph, nodeId: string): FlowNode[] {
  const outgoing = flow.edges.filter((e) => e.source === nodeId)
  const idSet = new Set(outgoing.map((e) => e.target))
  return flow.nodes.filter((n) => idSet.has(n.id))
}

/* ------------------------------ Node Executor ------------------------------ */

export async function executeNode(
  type: string | undefined,
  data: any,
  context: NodeExecutionContext,
): Promise<NodeExecutionResult> {
  switch (type) {
    case 'trigger':
      return {
        output: { triggered: true, payload: context.triggerPayload ?? null },
        log: 'Trigger fired.',
      }

    case 'ai-llm':
      return {
        output: { text: 'AI placeholder response (wire to OpenAI soon).' },
        log: `AI LLM executed, prompt: ${(data?.prompt ?? '').slice(0, 80)}`,
      }

    case 'ai-classifier':
      return {
        output: { label: (data?.classes ?? [])[0] ?? 'default' },
        log: `AI classifier labeled: ${(data?.classes ?? [])[0] ?? 'default'}`,
      }

    case 'ai-splitter':
      return {
        output: { splitKey: 'A' },
        log: 'AI splitter → path A.',
      }

    case 'or-path':
      return {
        output: { path: 'A' },
        log: 'OR path selected: A',
      }

    case 'delay':
      return {
        output: { completed: true },
        log: 'Delay executed (stub). Scheduler coming soon.',
      }

    case 'webhook':
      return {
        output: { status: 'queued' },
        log: `Webhook queued → ${data?.url ?? 'no-url'}`,
      }

    case 'crm-trigger':
      return {
        output: {
          provider: data?.provider,
          objectType: data?.objectType,
          payload: context.triggerPayload ?? null,
        },
        log: `CRM trigger received (${data?.provider ?? 'crm'})`,
      }

    case 'crm-action': {
      const countKey = context.automationId ?? 'unknown'
      actionCounts[countKey] = (actionCounts[countKey] ?? 0) + 1
      if (actionCounts[countKey] > 10) {
        await logAudit({
          workspaceId: context.workspaceId!,
          actorId: context.userProfileId ?? undefined,
          action: 'CRM_ACTION_RATE_LIMITED',
          targetType: 'Automation',
          targetId: context.automationId,
          meta: normalizeCRMAuditMeta({
            provider: data?.provider,
            action: data?.action,
            objectType: data?.objectType,
            count: actionCounts[countKey],
            integrationId: data?.integrationId,
            automationId: context.automationId,
            failureCategory: classifyCRMError('rate limit'),
          }),
        })
        return {
          output: { error: 'CRM action rate-limited' },
          log: 'CRM action skipped due to per-run rate limit.',
        }
      }

      const provider = (data?.provider ?? '') as IntegrationProvider
      const adapter = getIntegrationAdapter(provider)
      if (!adapter) {
        return {
          output: {},
          log: `CRM adapter not found for ${provider}`,
        }
      }

      const integrationId = data?.integrationId as string | undefined
      const integration = integrationId
        ? await prisma.integration.findUnique({
            where: { id: integrationId },
            include: { credentials: true },
          })
        : null

      // Kill switches: disable actions or all CRM
      if (
        process.env.CRM_DISABLE_ALL === 'true' ||
        process.env.CRM_DISABLE_ACTIONS === 'true'
      ) {
        await logAudit({
          workspaceId: context.workspaceId!,
          actorId: context.userProfileId ?? undefined,
          action: 'CRM_ACTION_FAILED',
          targetType: 'Automation',
          targetId: context.automationId,
          meta: {
            provider,
            action: data?.action,
            objectType: data?.objectType,
            integrationId,
            automationId: context.automationId,
            reason: 'CRM actions disabled',
          },
        })
        return {
          output: { error: 'CRM actions disabled' },
          log: 'CRM actions disabled via env flag.',
        }
      }

      const credential = integration?.credentials?.[0]
      const ctx = {
        workspaceId: context.workspaceId!,
        integrationId: integrationId ?? '',
        provider,
        credentials:
          credential && credential.accessToken
            ? {
                accessToken: decryptToken(credential.accessToken),
                refreshToken: credential.refreshToken
                  ? decryptToken(credential.refreshToken)
                  : undefined,
                expiresAt: credential.expiresAt ?? undefined,
              }
            : undefined,
      }

      const plan = await getWorkspacePlan(context.workspaceId!)
      const allowed = plan === 'Elite' || plan === 'Pro'
      if (!allowed) {
        await logAudit({
          workspaceId: context.workspaceId!,
          actorId: context.userProfileId ?? undefined,
          action: 'CRM_ACTION_FAILED',
          targetType: 'Automation',
          targetId: context.automationId,
          meta: {
            provider,
            action: data?.action,
            objectType: data?.objectType,
            integrationId,
            automationId: context.automationId,
            reason: 'Plan insufficient',
          },
        })
        return {
          output: { error: 'Plan insufficient for CRM action (requires Pro)' },
          log: 'CRM action skipped: plan insufficient (requires Pro).',
        }
      }

      // Circuit breaker check/reset
      if (integrationId) {
        const breaker = await resetBreakerIfNeeded(integrationId)
        if (breaker.reset) {
          await logAudit({
            workspaceId: context.workspaceId!,
            action: 'CRM_CIRCUIT_RESET',
            targetType: 'Integration',
            targetId: integrationId,
            meta: normalizeCRMAuditMeta({ provider, integrationId }),
          })
        }
        if (await isBreakerOpen(integrationId)) {
          await logAudit({
            workspaceId: context.workspaceId!,
            action: 'CRM_ACTION_RATE_LIMITED',
            targetType: 'Integration',
            targetId: integrationId,
            meta: normalizeCRMAuditMeta({
              provider,
              action: data?.action,
              objectType: data?.objectType,
              integrationId,
              automationId: context.automationId,
              reason: 'Circuit open',
              failureCategory: classifyCRMError('Circuit open'),
            }),
          })
          return {
            output: { error: 'CRM circuit open' },
            log: 'CRM action skipped (circuit open).',
          }
        }

        const meta = (integration?.metadata as any) || {}
        if (meta.disabled) {
          await logAudit({
            workspaceId: context.workspaceId!,
            action: 'CRM_ACTION_FAILED',
            targetType: 'Integration',
            targetId: integrationId,
            meta: {
              provider,
              action: data?.action,
              objectType: data?.objectType,
              integrationId,
              automationId: context.automationId,
              reason: 'Integration disabled',
            },
          })
          return {
            output: { error: 'Integration disabled' },
            log: 'CRM action skipped (integration disabled).',
          }
        }
      }

    try {
      const timeoutMs = 8000
      const execPromise = adapter.executeAction(ctx, data?.action, data?.payload ?? {})
      const defer = shouldDeferCRMAction({
        timeoutMs,
        expectedMs: (data?.payload as any)?.expectedMs,
      })
      const res = await Promise.race([
        execPromise,
        new Promise<IntegrationActionResult>((resolve) =>
          setTimeout(
            () => resolve({ ok: false, error: 'CRM_EXECUTION_TIMEOUT' }),
              timeoutMs,
            ),
          ),
        ])
        const externalId =
          data?.payload?.externalId ||
          (res.ok && (res.data?.id || res.data?.objectId || res.data?.externalId))

        if (externalId) {
          await upsertExternalRecord({
            workspaceId: context.workspaceId!,
            provider,
            objectType: data?.objectType ?? 'contact',
            externalId: String(externalId),
            integrationId,
            localType: 'AutomationRun',
            localId: context.automationId ?? null,
          })
        }

      if (res.ok) {
        await logAudit({
          workspaceId: context.workspaceId!,
          actorId: context.userProfileId ?? undefined,
          action: 'CRM_ACTION_EXECUTED',
          targetType: 'Automation',
          targetId: context.automationId,
          meta: normalizeCRMAuditMeta({
            provider,
            action: data?.action,
            objectType: data?.objectType,
            integrationId,
            automationId: context.automationId,
            externalId: externalId ? String(externalId) : undefined,
            ...(defer
              ? buildDeferMeta({
                  reason: 'Expected long-running CRM action',
                  expectedMs: (data?.payload as any)?.expectedMs,
                })
              : {}),
            failureCategory: 'unknown',
            failureSource: classifyFailureSource('crm-action'),
            ...(DEBUG_MODE
              ? {
                  debug: {
                    // Only include IDs/summary; never raw CRM payloads.
                    nodeType: 'crm-action',
                    action: data?.action,
                    objectType: data?.objectType,
                    integrationId,
                    automationId: context.automationId,
                  },
                }
              : {}),
          }),
        })
          if (integrationId && integration) {
            await prisma.integration.update({
              where: { id: integrationId },
              data: {
                metadata: {
                  ...(integration.metadata as any),
                  lastSuccessfulActionAt: new Date().toISOString(),
                  lastError: null,
                },
              },
            })
          }
      } else {
        if (res.error === 'CRM_EXECUTION_TIMEOUT') {
          await logAudit({
            workspaceId: context.workspaceId!,
            actorId: context.userProfileId ?? undefined,
            action: 'CRM_EXECUTION_TIMEOUT',
            targetType: 'Automation',
            targetId: context.automationId,
          meta: normalizeCRMAuditMeta({
            provider,
            action: data?.action,
            objectType: data?.objectType,
            integrationId,
            automationId: context.automationId,
            timeoutMs,
            failureCategory: classifyCRMError(res.error),
            ...(defer
              ? buildDeferMeta({
                  reason: 'Expected long-running CRM action',
                  expectedMs: (data?.payload as any)?.expectedMs,
                })
              : {}),
            failureSource: classifyFailureSource('crm-action'),
            ...(DEBUG_MODE
              ? {
                  debug: {
                    nodeType: 'crm-action',
                    action: data?.action,
                    objectType: data?.objectType,
                    integrationId,
                    automationId: context.automationId,
                    hint: 'timeout',
                  },
                }
              : {}),
          }),
        })
      }
      await logAudit({
        workspaceId: context.workspaceId!,
          actorId: context.userProfileId ?? undefined,
          action: 'CRM_ACTION_FAILED',
          targetType: 'Automation',
          targetId: context.automationId,
          meta: normalizeCRMAuditMeta({
            provider,
            action: data?.action,
            objectType: data?.objectType,
            integrationId,
            automationId: context.automationId,
            error: res.error,
            failureCategory: classifyCRMError(res.error),
            ...(defer
              ? buildDeferMeta({
                  reason: 'Expected long-running CRM action',
                  expectedMs: (data?.payload as any)?.expectedMs,
                })
              : {}),
            failureSource: classifyFailureSource('crm-action'),
            ...(DEBUG_MODE
              ? {
                  debug: {
                    nodeType: 'crm-action',
                    action: data?.action,
                    objectType: data?.objectType,
                    integrationId,
                    automationId: context.automationId,
                    hint: 'fail',
                  },
                }
              : {}),
          }),
        })
        if (integrationId) {
          await recordFailure(integrationId, context.workspaceId!, provider, res.error)
        }
      }

        return {
          output: res.ok ? res.data ?? {} : { error: res.error },
          log: res.ok
            ? `CRM action executed (${provider} • ${data?.action ?? 'unknown'})`
            : `CRM action failed: ${res.error ?? 'unknown error'}`,
        }
      } catch (err: any) {
        await logAudit({
          workspaceId: context.workspaceId!,
          actorId: context.userProfileId ?? undefined,
          action: 'CRM_ACTION_FAILED',
          targetType: 'Automation',
          targetId: context.automationId,
          meta: normalizeCRMAuditMeta({
            provider,
            action: data?.action,
            objectType: data?.objectType,
            integrationId,
            automationId: context.automationId,
            error: err?.message ?? 'unknown error',
          }),
        })
        if (integrationId) {
          await recordFailure(integrationId, context.workspaceId!, provider, err?.message)
        }

        return {
          output: { error: err?.message ?? 'CRM action failed' },
          log: `CRM action failed: ${err?.message ?? 'unknown error'}`,
        }
      }
    }

    case 'group':
      return {
        output: { grouped: true },
        log: 'Group node (visual only).',
      }

    default:
      return {
        output: {},
        log: `Unknown node type: ${type ?? 'none'}`,
      }
  }
}

/* ------------------------------ Standard Run Executor ------------------------------ */

export async function runAutomation(
  automationId: string,
  { triggerPayload, userProfileId }: RunOptions = {},
) {
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    include: { workspace: true },
  })

  if (!automation) throw new Error('Automation not found')
  if (automation.status !== 'ACTIVE') {
    throw new Error('Automation is not active')
  }

  const safeAutomation = automation

  const rawFlow = safeAutomation.flow as any as FlowGraph | null
  if (!rawFlow || !rawFlow.nodes?.length) {
    throw new Error('Automation has no flow')
  }

  const flow: FlowGraph = rawFlow

  const run = await prisma.automationRun.create({
    data: {
      automationId: safeAutomation.id,
      workspaceId: safeAutomation.workspaceId,
      status: 'RUNNING',
      log: '',
      userProfileId: userProfileId ?? null,
    },
  })

  const logLines: string[] = []
  const visited = new Set<string>()
  let executedNodes = 0
  const MAX_NODES = 200
  const MAX_DEPTH = 12

  async function processNode(nodeId: string, depth: number): Promise<void> {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    if (depth > MAX_DEPTH) {
      // Guard: stop deep recursion to avoid runaway execution
      await logAudit({
        workspaceId: safeAutomation.workspaceId,
        action: 'AUTOMATION_GUARD_DEPTH',
        targetType: 'Automation',
        targetId: safeAutomation.id,
        meta: { depth, reason: 'Max depth reached' },
      })
      return
    }
    executedNodes += 1
    if (executedNodes > MAX_NODES) {
      // Guard: stop if too many nodes executed in a single run
      await logAudit({
        workspaceId: safeAutomation.workspaceId,
        action: 'AUTOMATION_GUARD_NODES',
        targetType: 'Automation',
        targetId: safeAutomation.id,
        meta: { executedNodes, reason: 'Max nodes reached' },
      })
      return
    }

    const node = flow.nodes.find((n) => n.id === nodeId)
    if (!node) return

    const context: NodeExecutionContext = {
      triggerPayload,
      depth,
      workspaceId: safeAutomation.workspaceId,
      automationId: safeAutomation.id,
      userProfileId: userProfileId ?? null,
    }
    const result = await executeNode(node.type, node.data, context)

    logLines.push(`[${node.type ?? 'node'}:${node.id}] ${result.log}`)

    await prisma.automationRunEvent.create({
      data: {
        runId: run.id,
        nodeId: node.id,
        nodeType: node.type ?? 'unknown',
        status: 'RUNNING',
        message: result.log,
        path: result.output?.path ?? null,
      },
    })

    const next = nextNodes(flow, node.id)
    for (const n of next) await processNode(n.id, depth + 1)
  }

  try {
    const roots = findStartNodes(flow)
    if (!roots.length) logLines.push('⚠ No root nodes found.')

    for (const root of roots) await processNode(root.id, 0)

    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        log: logLines.join('\n'),
      },
    })

    return run.id
  } catch (err: any) {
    logLines.push(`ERROR: ${err?.message}`)

    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        log: logLines.join('\n'),
      },
    })

    throw err
  }
}

/* ------------------------------ LIVE STREAMING EXECUTOR (SSE) ------------------------------ */

export async function executeAutomationLive(
  _prismaClient: any,
  runId: string,
  flow: FlowGraph,
  emit: (evt: any) => Promise<void>,
) {
  const visited = new Set<string>()
  const logLines: string[] = []

  async function processNode(nodeId: string, depth: number) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    const node = flow.nodes.find((n) => n.id === nodeId)
    if (!node) return

    const result = await executeNode(node.type, node.data, { depth })

    const evt = {
      kind: 'nodeEnd',
      runId,
      nodeId: node.id,
      nodeType: node.type ?? 'unknown',
      status: 'SUCCESS',
      message: result.log,
      path: result.output?.path ?? null,
    }

    logLines.push(`[${node.type}:${node.id}] ${result.log}`)

    await emit(evt)

    const outgoing = nextNodes(flow, node.id)
    for (const n of outgoing) await processNode(n.id, depth + 1)
  }

  try {
    const roots = findStartNodes(flow)
    if (!roots.length) logLines.push('⚠ No root nodes found.')

    for (const r of roots) await processNode(r.id, 0)

    return { success: true, log: logLines.join('\n') }
  } catch (err: any) {
    logLines.push('ERROR: ' + (err.message ?? 'unknown'))
    return { success: false, log: logLines.join('\n') }
  }
}
