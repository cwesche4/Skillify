// lib/automations/executor.ts
import { RunStatus, AutomationStatus } from "@prisma/client"

import { prisma } from "@/lib/db"

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
  depth: number
}

export interface NodeExecutionResult {
  output: Record<string, any>
  log: string
}

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
    case "trigger":
      return {
        output: { triggered: true, payload: context.triggerPayload ?? null },
        log: "Trigger fired.",
      }

    case "ai-llm":
      return {
        output: { text: "AI placeholder response (wire to OpenAI soon)." },
        log: `AI LLM executed, prompt: ${(data?.prompt ?? "").slice(0, 80)}`,
      }

    case "ai-classifier":
      return {
        output: { label: (data?.classes ?? [])[0] ?? "default" },
        log: `AI classifier labeled: ${(data?.classes ?? [])[0] ?? "default"}`,
      }

    case "ai-splitter":
      return {
        output: { splitKey: "A" },
        log: "AI splitter → path A.",
      }

    case "or-path":
      return {
        output: { path: "A" },
        log: "OR path selected: A",
      }

    case "delay":
      return {
        output: { completed: true },
        log: "Delay executed (stub). Scheduler coming soon.",
      }

    case "webhook":
      return {
        output: { status: "queued" },
        log: `Webhook queued → ${data?.url ?? "no-url"}`,
      }

    case "group":
      return {
        output: { grouped: true },
        log: "Group node (visual only).",
      }

    default:
      return {
        output: {},
        log: `Unknown node type: ${type ?? "none"}`,
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

  if (!automation) throw new Error("Automation not found")
  if (automation.status !== AutomationStatus.ACTIVE)
    throw new Error("Automation is not active")

  const rawFlow = automation.flow as any as FlowGraph | null
  if (!rawFlow || !rawFlow.nodes?.length) throw new Error("Automation has no flow")

  const flow: FlowGraph = rawFlow

  const run = await prisma.automationRun.create({
    data: {
      automationId: automation.id,
      workspaceId: automation.workspaceId,
      status: RunStatus.RUNNING,
      log: "",
      userProfileId: userProfileId ?? null,
    },
  })

  const logLines: string[] = []
  const visited = new Set<string>()

  async function processNode(nodeId: string, depth: number): Promise<void> {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    const node = flow.nodes.find((n) => n.id === nodeId)
    if (!node) return

    const context: NodeExecutionContext = { triggerPayload, depth }
    const result = await executeNode(node.type, node.data, context)

    logLines.push(`[${node.type ?? "node"}:${node.id}] ${result.log}`)

    await prisma.automationRunEvent.create({
      data: {
        runId: run.id,
        nodeId: node.id,
        nodeType: node.type ?? "unknown",
        status: RunStatus.RUNNING,
        message: result.log,
        path: result.output?.path ?? null,
      },
    })

    const next = nextNodes(flow, node.id)
    for (const n of next) await processNode(n.id, depth + 1)
  }

  try {
    const roots = findStartNodes(flow)
    if (!roots.length) logLines.push("⚠ No root nodes found.")

    for (const root of roots) await processNode(root.id, 0)

    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: RunStatus.SUCCESS,
        finishedAt: new Date(),
        log: logLines.join("\n"),
      },
    })

    return run.id
  } catch (err: any) {
    logLines.push(`ERROR: ${err?.message}`)

    await prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: RunStatus.FAILED,
        finishedAt: new Date(),
        log: logLines.join("\n"),
      },
    })

    throw err
  }
}

/* ------------------------------ LIVE STREAMING EXECUTOR (SSE) ------------------------------ */

export async function executeAutomationLive(
  prismaClient: any,
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
      kind: "nodeEnd",
      runId,
      nodeId: node.id,
      nodeType: node.type ?? "unknown",
      status: "SUCCESS",
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
    if (!roots.length) logLines.push("⚠ No root nodes found.")

    for (const r of roots) await processNode(r.id, 0)

    return { success: true, log: logLines.join("\n") }
  } catch (err: any) {
    logLines.push("ERROR: " + (err.message ?? "unknown"))
    return { success: false, log: logLines.join("\n") }
  }
}
