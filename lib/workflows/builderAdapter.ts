import type { BuilderNodeType } from '@/lib/builder/node-types'
import {
  getBuilderNodeTypeForDefinition,
  workflowNodeRegistry,
} from '@/lib/workflows/nodeRegistry'

export type WorkflowBuilderPaletteItem = {
  id: string
  type: BuilderNodeType
  label: string
  category: string
  description: string
  iconKey?: string
  requiredPlan?: 'Pro' | 'Elite'
  canBeTrigger?: boolean
  canBeAction?: boolean
  keywords: string
}

export function getWorkflowBuilderPaletteItems(): WorkflowBuilderPaletteItem[] {
  return workflowNodeRegistry.map((definition) => ({
    id: definition.id,
    type: getBuilderNodeTypeForDefinition(definition),
    label: definition.label,
    category: definition.category,
    description: definition.description,
    iconKey: definition.iconKey ?? definition.ui?.icon,
    requiredPlan:
      definition.planRequirement === 'elite'
        ? 'Elite'
        : definition.planRequirement === 'pro'
          ? 'Pro'
          : undefined,
    canBeTrigger: definition.canBeTrigger,
    canBeAction: definition.canBeAction,
    keywords: [
      definition.id,
      definition.type,
      definition.label,
      definition.category,
      definition.description,
      definition.iconKey,
      definition.aiDescription,
      definition.documentation,
      definition.ui?.builderNodeType,
      ...(definition.configFields ?? []).map((field) => field.label),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  }))
}
