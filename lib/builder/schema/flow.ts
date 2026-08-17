import { z } from 'zod'

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

const nodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: positionSchema,
  data: z.record(z.any()).default({}),
  parentGroupId: z.string().optional(), // Node belongs to a group (one-level nesting max)
  groupChildren: z.array(z.string()).optional(), // Only for group nodes
  collapsed: z.boolean().optional(), // Only for group nodes
})

const edgeSchema = z.any()

const flowSchema = z.object({
  id: z.string().optional(),
  nodes: z.array(nodeSchema).default([]),
  edges: z.array(edgeSchema).default([]),
})

export type FlowNode = z.infer<typeof nodeSchema>
export type FlowEdge = z.infer<typeof edgeSchema>
export type ParsedFlow = {
  id: string
  nodes: FlowNode[]
  edges: FlowEdge[]
}

/**
 * Parse persisted Automation.flow JSON with grouping metadata.
 * Backward compatible: missing fields default safely.
 */
export function parseFlowJson(raw: any): ParsedFlow {
  const parsed = flowSchema.safeParse(raw ?? {})
  if (!parsed.success) {
    return { id: raw?.id ?? '', nodes: [], edges: [] }
  }
  const value = parsed.data
  return {
    id: value.id ?? '',
    nodes: value.nodes.map((n) => ({
      ...n,
      data: n.data ?? {},
      parentGroupId: n.parentGroupId,
      groupChildren: n.groupChildren,
      collapsed: n.collapsed,
    })),
    edges: value.edges,
  }
}
