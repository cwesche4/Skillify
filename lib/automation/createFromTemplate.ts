import { prisma } from '@/lib/db'
import { cloneTemplateData } from '@/lib/templates/cloneTemplate'
import { validateNodeData } from '@/lib/builder/node-schemas'

/**
 * Create a draft automation from a template.
 * - New automation + flow snapshot
 * - Draft version status
 * - Runs validation on nodes immediately
 */
export async function createAutomationFromTemplate(params: {
  template: any
  workspaceId: string
  userId: string
}) {
  const clone = cloneTemplateData(params.template)

  const automation = await prisma.automation.create({
    data: {
      name: clone.label,
      description: clone.description,
      workspaceId: params.workspaceId,
      userId: params.userId,
      status: 'INACTIVE',
      flow: clone.flow,
    },
  })

  // Create draft version snapshot (immutable)
  await prisma.automationVersion.create({
    data: {
      automationId: automation.id,
      workspaceId: params.workspaceId,
      createdByUserId: params.userId,
      label: 'Draft from template',
      message: `Cloned from template ${clone.sourceTemplateId ?? ''}`,
      status: 'DRAFT',
      snapshots: {
        create: {
          flowJson: clone.flow,
          nodeCount: Array.isArray(clone.flow?.nodes)
            ? clone.flow.nodes.length
            : 0,
          edgeCount: Array.isArray(clone.flow?.edges)
            ? clone.flow.edges.length
            : 0,
          checksum: '',
        },
      },
    },
  })

  // Run validation (non-blocking result for now)
  const validationErrors: string[] = []
  if (Array.isArray(clone.flow?.nodes)) {
    for (const n of clone.flow.nodes) {
      const res = validateNodeData(n.type, n.data ?? {})
      if (!res.ok) {
        validationErrors.push(...(res.errors ?? []))
      }
    }
  }

  return { automationId: automation.id, validationErrors }
}
