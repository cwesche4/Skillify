import { describe, expect, it } from 'vitest'

import {
  conditionOperatorNeedsValue,
  conditionOperatorsForType,
  conditionValueLabel,
  conditionValueOptionsForField,
  conditionValuePresetsForField,
  getConditionFieldCandidates,
  isConditionValueCompatible,
  normalizeConditionValue,
  parseConditionExpression,
  serializeConditionRule,
} from '@/lib/workflows/conditionBuilder'
import type { WorkflowVariableDefinition } from '@/lib/workflows/variableRegistry'

const candidates = [
  {
    token: '{{client.health}}',
    label: 'Client Health',
    type: 'string' as const,
  },
  {
    token: '{{task.priority}}',
    label: 'Task Priority',
    type: 'string' as const,
  },
  { token: '{{lead.email}}', label: 'Lead Email', type: 'email' as const },
  { token: '{{company.name}}', label: 'Company Name', type: 'string' as const },
]

const variables: WorkflowVariableDefinition[] = [
  {
    id: 'lead.email',
    key: 'lead.email',
    path: 'lead.email',
    token: '{{lead.email}}',
    label: 'Lead Email',
    type: 'email',
    valueType: 'email',
    category: 'Lead',
    previewValue: 'lead@example.com',
    sampleValue: 'lead@example.com',
  },
  {
    id: 'client.owner',
    key: 'client.owner',
    path: 'client.owner',
    token: '{{client.owner}}',
    label: 'Client Owner',
    type: 'string',
    valueType: 'string',
    category: 'Client',
    previewValue: 'Ops Team',
    sampleValue: 'Ops Team',
  },
  {
    id: 'task.priority',
    key: 'task.priority',
    path: 'task.priority',
    token: '{{task.priority}}',
    label: 'Task Priority',
    type: 'string',
    valueType: 'string',
    category: 'Task',
    previewValue: 'High',
    sampleValue: 'High',
  },
  {
    id: 'webhook.payload',
    key: 'webhook.payload',
    path: 'payload',
    token: '{{nodes.webhook.payload}}',
    label: 'Webhook Payload',
    type: 'object',
    valueType: 'object',
    category: 'Custom Variables',
    sourceNodeId: 'webhook',
    sourceNodeLabel: 'Webhook',
    previewValue: { ok: true },
    sampleValue: { ok: true },
  },
  {
    id: 'automation.run_id',
    key: 'automation.run_id',
    path: 'automation.run_id',
    token: '{{automation.run_id}}',
    label: 'Run ID',
    type: 'string',
    valueType: 'string',
    category: 'Automation',
    previewValue: 'run_123',
    sampleValue: 'run_123',
  },
]

describe('condition builder helpers', () => {
  it('serializes readable structured rules to canonical expressions', () => {
    expect(
      serializeConditionRule({
        fieldToken: '{{client.health}}',
        fieldLabel: 'Client Health',
        fieldType: 'string',
        operator: 'is',
        value: 'At Risk',
      }),
    ).toBe('{{client.health}} == "At Risk"')
    expect(
      serializeConditionRule({
        fieldToken: '{{lead.email}}',
        fieldLabel: 'Lead Email',
        fieldType: 'email',
        operator: 'exists',
      }),
    ).toBe('{{lead.email}} exists')
  })

  it('parses supported expressions and falls back for unsupported expressions', () => {
    expect(
      parseConditionExpression(
        '{{company.name}} contains "Electric"',
        candidates,
      ),
    ).toEqual(
      expect.objectContaining({
        fieldToken: '{{company.name}}',
        operator: 'contains',
        value: 'Electric',
      }),
    )
    expect(
      parseConditionExpression('client.health ~= At Risk', candidates),
    ).toBeNull()
  })

  it('provides business presets only for fields with meaningful condition values', () => {
    expect(
      conditionValuePresetsForField({
        fieldLabel: 'Client Health',
        fieldType: 'string',
      }),
    ).toEqual(['Healthy', 'Needs Attention', 'At Risk'])
    expect(
      conditionValuePresetsForField({
        fieldLabel: 'Owner',
        fieldType: 'string',
      }),
    ).toEqual(['Owner', 'Ops Team', 'Support Team', 'Skillify AI'])
    expect(
      conditionValuePresetsForField({
        fieldLabel: 'Lead Email',
        fieldType: 'email',
      }),
    ).toEqual([])
  })

  it('validates condition values against field type and selected operator', () => {
    expect(conditionOperatorNeedsValue('email', 'exists')).toBe(false)
    expect(
      isConditionValueCompatible({
        fieldLabel: 'Lead Email',
        fieldType: 'email',
        operator: 'exists',
      }),
    ).toBe(true)
    expect(
      isConditionValueCompatible({
        fieldLabel: 'Wait Duration',
        fieldType: 'duration',
        operator: 'greater_than',
        value: '30',
      }),
    ).toBe(true)
    expect(
      isConditionValueCompatible({
        fieldLabel: 'Wait Duration',
        fieldType: 'duration',
        operator: 'greater_than',
        value: 'tomorrow',
      }),
    ).toBe(false)
    expect(
      isConditionValueCompatible({
        fieldLabel: 'Client Health',
        fieldType: 'string',
        operator: 'is',
        value: 'At Risk',
      }),
    ).toBe(true)
    expect(
      isConditionValueCompatible({
        fieldLabel: 'Client Health',
        fieldType: 'string',
        operator: 'is',
        value: 'support@example.com',
      }),
    ).toBe(false)
  })

  it('filters and groups condition field candidates by semantic usefulness', () => {
    const fields = getConditionFieldCandidates(variables)
    expect(fields.map((field) => field.label)).toEqual(
      expect.arrayContaining([
        'Lead Email',
        'Client Owner',
        'Task Priority',
        'Run ID',
      ]),
    )
    expect(fields.map((field) => field.label)).not.toContain('Webhook Payload')
    expect(fields.find((field) => field.label === 'Lead Email')).toMatchObject({
      category: 'Customer and CRM',
      semanticRole: 'email',
    })
    expect(
      fields.find((field) => field.label === 'Task Priority'),
    ).toMatchObject({
      category: 'Tasks and Operations',
      semanticRole: 'priority',
    })
    expect(fields.find((field) => field.label === 'Run ID')).toMatchObject({
      category: 'Advanced fields',
      semanticRole: 'technical',
    })
  })

  it('ranks business condition fields before advanced workflow metadata', () => {
    const fields = getConditionFieldCandidates(variables)
    const labels = fields.map((field) => field.label)

    expect(labels.indexOf('Client Owner')).toBeLessThan(
      labels.indexOf('Run ID'),
    )
    expect(fields.at(-1)).toMatchObject({
      label: 'Run ID',
      category: 'Advanced fields',
      advanced: true,
    })
  })

  it('uses type-aware condition operators and hides values for empty checks', () => {
    expect(
      conditionOperatorsForType('email').map((item) => item.value),
    ).toEqual(['is', 'is_not', 'contains', 'exists', 'not_exists'])
    expect(
      conditionOperatorsForType('string', 'priority').map((item) => item.value),
    ).toEqual(['is', 'is_not', 'any_of', 'none_of', 'exists', 'not_exists'])
    expect(conditionOperatorNeedsValue('string', 'exists', 'priority')).toBe(
      false,
    )
    expect(conditionOperatorNeedsValue('string', 'any_of', 'priority')).toBe(
      true,
    )
    expect(
      conditionValuePresetsForField({
        fieldLabel: 'Task Priority',
        fieldType: 'string',
        semanticRole: 'priority',
      }),
    ).toEqual(['Low', 'Medium', 'High', 'Urgent'])
  })

  it('rejects semantic mismatches between field and literal condition value', () => {
    expect(
      isConditionValueCompatible({
        fieldLabel: 'Owner Email',
        fieldType: 'email',
        semanticRole: 'email',
        operator: 'is',
        value: 'Owner',
      }),
    ).toBe(false)
    expect(
      isConditionValueCompatible({
        fieldLabel: 'Client Owner',
        fieldType: 'string',
        semanticRole: 'owner',
        operator: 'is',
        value: 'Ops Team',
      }),
    ).toBe(true)
  })

  it('uses stable canonical option identities for entity-reference values', () => {
    const options = conditionValueOptionsForField({
      fieldLabel: 'Client Owner',
      fieldType: 'string',
      semanticRole: 'owner',
    })

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'team-ops',
          label: 'Ops Team',
          value: '{{team.ops}}',
        }),
      ]),
    )
    expect(
      normalizeConditionValue({
        fieldLabel: 'Client Owner',
        fieldType: 'string',
        semanticRole: 'owner',
        value: 'Ops Team',
      }),
    ).toBe('{{team.ops}}')
    expect(
      conditionValueLabel({
        fieldLabel: 'Client Owner',
        fieldType: 'string',
        semanticRole: 'owner',
        value: '{{team.ops}}',
      }),
    ).toBe('Ops Team')
    expect(
      serializeConditionRule({
        fieldToken: '{{client.owner}}',
        fieldLabel: 'Client Owner',
        fieldType: 'string',
        fieldSemanticRole: 'owner',
        operator: 'is',
        value: '{{team.ops}}',
      }),
    ).toBe('{{client.owner}} == "{{team.ops}}"')
  })

  it('keeps finite option lists complete after a value is selected', () => {
    const first = conditionValueOptionsForField({
      fieldLabel: 'Task Priority',
      fieldType: 'string',
      semanticRole: 'priority',
    })
    const selected = normalizeConditionValue({
      fieldLabel: 'Task Priority',
      fieldType: 'string',
      semanticRole: 'priority',
      value: 'High',
    })
    const reopened = conditionValueOptionsForField({
      fieldLabel: 'Task Priority',
      fieldType: 'string',
      semanticRole: 'priority',
    })

    expect(selected).toBe('High')
    expect(reopened).toEqual(first)
    expect(reopened.map((option) => option.label)).toEqual([
      'Low',
      'Medium',
      'High',
      'Urgent',
    ])
  })

  it('parses canonical reference values without relying on option object identity', () => {
    const expression = '{{client.owner}} == "{{team.ops}}"'
    expect(
      parseConditionExpression(expression, [
        {
          token: '{{client.owner}}',
          label: 'Client Owner',
          type: 'string',
          semanticRole: 'owner',
        },
      ]),
    ).toEqual(
      expect.objectContaining({
        fieldToken: '{{client.owner}}',
        fieldSemanticRole: 'owner',
        operator: 'is',
        value: '{{team.ops}}',
      }),
    )
  })
})
