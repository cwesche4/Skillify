import type { NodeConfigField, WorkflowValueType } from '@/lib/workflows/types'

export type WorkspaceFieldOption = {
  label: string
  value: string
  type?: WorkflowValueType
  source: string
  unavailable?: boolean
}

export type WorkflowWorkspaceOptionContext = {
  members?: Array<{
    id?: string
    userId?: string
    fullName?: string | null
    email?: string | null
    role?: string | null
  }>
  teams?: Array<{ id: string; name: string }>
  departments?: Array<{ id: string; name: string }>
  stages?: Array<{ id: string; name: string }>
  statuses?: Array<{ id: string; name: string }>
  healthStatuses?: Array<{ id: string; name: string }>
  priorities?: Array<{ id: string; name: string }>
  custom?: Record<string, Array<{ label: string; value: string }>>
}

function option(
  label: unknown,
  value: unknown,
  source: string,
  type: WorkflowValueType = 'string',
): WorkspaceFieldOption | null {
  const resolvedLabel = typeof label === 'string' ? label.trim() : ''
  const resolvedValue = typeof value === 'string' ? value.trim() : ''
  if (!resolvedLabel || !resolvedValue) return null
  return { label: resolvedLabel, value: resolvedValue, source, type }
}

function categoryForField(
  field?: Pick<
    NodeConfigField,
    'workspaceOptionCategory' | 'semanticRole' | 'semanticType' | 'optionSource'
  > | null,
) {
  if (!field) return undefined
  if (field.workspaceOptionCategory) return field.workspaceOptionCategory
  if (field.optionSource?.startsWith('workspace.'))
    return field.optionSource.slice('workspace.'.length)
  if (field.semanticRole === 'owner' || field.semanticRole === 'assignee')
    return 'members'
  if (field.semanticRole === 'team') return 'teams'
  if (field.semanticType === 'stage') return 'crmStages'
  if (field.semanticType === 'healthStatus') return 'healthStatuses'
  if (field.semanticType === 'priority') return 'priorities'
  if (field.semanticType === 'durationUnit') return 'durationUnits'
  return undefined
}

export function resolveWorkspaceFieldOptions({
  field,
  workspace,
  currentValue,
}: {
  field?: Pick<
    NodeConfigField,
    | 'options'
    | 'workspaceOptionCategory'
    | 'semanticRole'
    | 'semanticType'
    | 'optionSource'
  > | null
  workspace?: WorkflowWorkspaceOptionContext | null
  currentValue?: unknown
}): WorkspaceFieldOption[] {
  const category = categoryForField(field)
  const resolved: WorkspaceFieldOption[] = []
  if (category === 'members') {
    resolved.push(
      ...(workspace?.members ?? [])
        .map((member) =>
          option(
            member.fullName || member.email,
            member.userId || member.id,
            'workspace.members',
          ),
        )
        .filter((item): item is WorkspaceFieldOption => Boolean(item)),
    )
  } else if (category === 'teams') {
    resolved.push(
      ...(workspace?.teams ?? [])
        .map((team) => option(team.name, team.id, 'workspace.teams'))
        .filter((item): item is WorkspaceFieldOption => Boolean(item)),
    )
  } else if (category === 'departments') {
    resolved.push(
      ...(workspace?.departments ?? [])
        .map((department) =>
          option(department.name, department.id, 'workspace.departments'),
        )
        .filter((item): item is WorkspaceFieldOption => Boolean(item)),
    )
  } else if (category === 'crmStages' || category === 'stages') {
    resolved.push(
      ...(workspace?.stages ?? [])
        .map((stage) => option(stage.name, stage.id, 'workspace.stages'))
        .filter((item): item is WorkspaceFieldOption => Boolean(item)),
    )
  } else if (category === 'healthStatuses') {
    resolved.push(
      ...(workspace?.healthStatuses ?? [])
        .map((status) =>
          option(status.name, status.id, 'workspace.healthStatuses'),
        )
        .filter((item): item is WorkspaceFieldOption => Boolean(item)),
    )
  } else if (category === 'priorities') {
    resolved.push(
      ...(workspace?.priorities ?? [])
        .map((priority) =>
          option(priority.name, priority.id, 'workspace.priorities'),
        )
        .filter((item): item is WorkspaceFieldOption => Boolean(item)),
    )
  } else if (category && workspace?.custom?.[category]) {
    resolved.push(
      ...workspace.custom[category]
        .map((item) => option(item.label, item.value, `workspace.${category}`))
        .filter((item): item is WorkspaceFieldOption => Boolean(item)),
    )
  }

  resolved.push(
    ...(field?.options ?? [])
      .map((item) => option(item.label, item.value, 'registry.options'))
      .filter((item): item is WorkspaceFieldOption => Boolean(item)),
  )

  const unique = Array.from(
    new Map(resolved.map((item) => [item.value, item])).values(),
  )
  const value = typeof currentValue === 'string' ? currentValue.trim() : ''
  if (
    value &&
    !unique.some((item) => item.value === value || item.label === value)
  ) {
    unique.unshift({
      label: `${value} (Unavailable)`,
      value,
      source: category ? `workspace.${category}` : 'workspace',
      unavailable: true,
      type: 'string',
    })
  }
  return unique
}
