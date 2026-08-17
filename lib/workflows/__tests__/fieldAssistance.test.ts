import { describe, expect, it } from 'vitest'

import { getContextualFieldSuggestions } from '@/lib/workflows/fieldAssistance'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import type { NodeConfigField } from '@/lib/workflows/types'
import type { WorkflowVariableDefinition } from '@/lib/workflows/variableRegistry'

const variables: WorkflowVariableDefinition[] = [
  {
    id: 'nodes.lead.lead.email',
    key: 'nodes.lead.lead.email',
    path: 'lead.email',
    token: '{{nodes.lead.lead.email}}',
    label: 'Lead Email',
    type: 'email',
    valueType: 'email',
    category: 'Lead',
    sourceNodeId: 'lead',
    origin: 'Lead Created',
    previewValue: 'lead@example.com',
    sampleValue: 'lead@example.com',
  },
  {
    id: 'nodes.lead.lead.phone',
    key: 'nodes.lead.lead.phone',
    path: 'lead.phone',
    token: '{{nodes.lead.lead.phone}}',
    label: 'Lead Phone',
    type: 'phone',
    valueType: 'phone',
    category: 'Lead',
    sourceNodeId: 'lead',
    origin: 'Lead Created',
    previewValue: '+1 555 555 5555',
    sampleValue: '+1 555 555 5555',
  },
  {
    id: 'client.name',
    key: 'client.name',
    path: 'client.name',
    token: '{{client.name}}',
    label: 'Client Name',
    type: 'string',
    valueType: 'string',
    category: 'Workspace Variables',
    previewValue: 'NorthStar Electric',
    sampleValue: 'NorthStar Electric',
  },
  {
    id: 'workspace.email',
    key: 'workspace.email',
    path: 'workspace.email',
    token: '{{workspace.email}}',
    label: 'Workspace Email',
    type: 'email',
    valueType: 'email',
    category: 'Workspace Variables',
    previewValue: 'support@example.com',
    sampleValue: 'support@example.com',
  },
  {
    id: 'wait.duration',
    key: 'wait.duration',
    path: 'duration',
    token: '{{nodes.wait.duration}}',
    label: 'Wait Duration',
    type: 'number',
    valueType: 'number',
    category: 'Custom Variables',
    sourceNodeId: 'wait',
    origin: 'Wait / Delay',
    previewValue: 30,
    sampleValue: 30,
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
    previewValue: 'run_preview_001',
    sampleValue: 'run_preview_001',
  },
  {
    id: 'nodes.webhook.payload',
    key: 'nodes.webhook.payload',
    path: 'payload',
    token: '{{nodes.webhook.payload}}',
    label: 'Webhook Payload',
    type: 'object',
    valueType: 'object',
    category: 'Custom Variables',
    sourceNodeId: 'webhook',
    origin: 'Webhook',
    previewValue: { id: '123' },
    sampleValue: { id: '123' },
  },
  {
    id: 'service_request.address',
    key: 'service_request.address',
    path: 'service_request.address',
    token: '{{service_request.address}}',
    label: 'Service Address',
    type: 'string',
    valueType: 'string',
    category: 'Service Request',
    previewValue: '1200 Market St',
    sampleValue: '1200 Market St',
  },
]

describe('contextual field assistance', () => {
  it('includes examples only when the field is empty', () => {
    const field: NodeConfigField = {
      id: 'body',
      label: 'Body',
      type: 'textarea',
      defaultValue: 'Hi {{client.name}},',
      supportsVariables: true,
      allowsMixedText: true,
      semanticType: 'messageBody',
      suggestionMode: 'presetsAndWorkflowData',
    }

    expect(
      getContextualFieldSuggestions({ field, value: '', variables })[0],
    ).toEqual(
      expect.objectContaining({
        kind: 'example',
        value: 'Hi {{client.name}},',
      }),
    )
    expect(
      getContextualFieldSuggestions({
        field,
        value: 'Existing',
        variables,
      }).some((suggestion) => suggestion.kind === 'example'),
    ).toBe(false)
  })

  it('filters suggestions by accepted field type', () => {
    const emailField: NodeConfigField = {
      id: 'recipient',
      label: 'Recipient',
      type: 'text',
      acceptedTypes: ['email'],
      supportsVariables: true,
      allowsMixedText: false,
      semanticType: 'emailAddress',
      suggestionMode: 'presetsAndWorkflowData',
    }
    const phoneField: NodeConfigField = {
      id: 'phone',
      label: 'Phone',
      type: 'text',
      acceptedTypes: ['phone'],
      supportsVariables: true,
      allowsMixedText: false,
      semanticType: 'phoneNumber',
      suggestionMode: 'presetsAndWorkflowData',
    }

    expect(
      getContextualFieldSuggestions({
        field: emailField,
        value: '',
        variables,
      }).map((item) => item.label),
    ).toContain('Lead Email')
    expect(
      getContextualFieldSuggestions({
        field: emailField,
        value: '',
        variables,
      }).map((item) => item.label),
    ).not.toContain('Lead Phone')
    expect(
      getContextualFieldSuggestions({
        field: phoneField,
        value: '',
        variables,
      }).map((item) => item.label),
    ).toContain('Lead Phone')
  })

  it('uses semantic presets instead of flooding stage fields with generic strings', () => {
    const stageField: NodeConfigField = {
      id: 'stage',
      label: 'Stage',
      type: 'text',
      acceptedTypes: ['string'],
      semanticType: 'stage',
      suggestionMode: 'presets',
      supportsVariables: true,
      allowsMixedText: false,
    }
    const labels = getContextualFieldSuggestions({
      field: stageField,
      value: '',
      variables,
    }).map((item) => item.label)

    expect(labels).toEqual(
      expect.arrayContaining(['New', 'Qualified', 'Proposal']),
    )
    expect(labels).not.toContain('Lead Email')
    expect(labels).not.toContain('Wait Duration')
  })

  it('shows next-action and owner presets without unrelated workflow variables', () => {
    const nextActionField: NodeConfigField = {
      id: 'nextAction',
      label: 'Next action',
      type: 'text',
      acceptedTypes: ['string'],
      semanticType: 'nextAction',
      suggestionMode: 'presets',
      supportsVariables: true,
    }
    const ownerField: NodeConfigField = {
      id: 'owner',
      label: 'Owner',
      type: 'text',
      acceptedTypes: ['string'],
      semanticType: 'owner',
      suggestionMode: 'presets',
      supportsVariables: true,
    }

    expect(
      getContextualFieldSuggestions({
        field: nextActionField,
        value: '',
        variables,
      }).map((item) => item.label),
    ).toContain('Schedule kickoff call')
    expect(
      getContextualFieldSuggestions({
        field: ownerField,
        value: '',
        variables,
      }).map((item) => item.label),
    ).toEqual(expect.arrayContaining(['Owner', 'Ops Team']))
    expect(
      getContextualFieldSuggestions({
        field: ownerField,
        value: '',
        variables,
      }).map((item) => item.label),
    ).not.toContain('Lead Phone')
  })

  it('ranks customer data above workspace metadata for message bodies', () => {
    const bodyField: NodeConfigField = {
      id: 'body',
      label: 'Body',
      type: 'textarea',
      acceptedTypes: ['string', 'email', 'phone'],
      semanticType: 'messageBody',
      suggestionMode: 'presetsAndWorkflowData',
      supportsVariables: true,
      allowsMixedText: true,
    }
    const labels = getContextualFieldSuggestions({
      field: bodyField,
      value: 'Hello',
      variables,
    }).map((item) => item.label)

    expect(labels.indexOf('Client Name')).toBeGreaterThanOrEqual(0)
    expect(labels.indexOf('Workspace Email')).toBeGreaterThan(
      labels.indexOf('Client Name'),
    )
  })

  it('hides technical IDs and object outputs from customer-facing inline text suggestions', () => {
    const bodyField: NodeConfigField = {
      id: 'body',
      label: 'Body',
      type: 'textarea',
      acceptedTypes: ['string', 'email', 'phone', 'number'],
      semanticRole: 'message',
      semanticType: 'messageBody',
      suggestionMode: 'presetsAndWorkflowData',
      supportsVariables: true,
      allowsMixedText: true,
    }
    const labels = getContextualFieldSuggestions({
      field: bodyField,
      value: 'Thanks',
      variables,
    }).map((item) => item.label)

    expect(labels).toContain('Client Name')
    expect(labels).toContain('Service Address')
    expect(labels).not.toContain('Run ID')
    expect(labels).not.toContain('Webhook Payload')
  })

  it('uses stable canonical references for owner and team display choices', () => {
    const ownerField: NodeConfigField = {
      id: 'owner',
      label: 'Owner',
      type: 'text',
      acceptedTypes: ['string'],
      semanticRole: 'owner',
      semanticType: 'owner',
      suggestionMode: 'presets',
      storesReference: true,
      supportsVariables: true,
    }
    const suggestions = getContextualFieldSuggestions({
      field: ownerField,
      value: '',
      variables,
    })

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Owner', value: '{{owner.id}}' }),
        expect.objectContaining({ label: 'Ops Team', value: '{{team.ops}}' }),
        expect.objectContaining({
          label: 'Support Team',
          value: '{{team.support}}',
        }),
      ]),
    )
  })

  it('keeps status and priority fields on finite business options', () => {
    const statusField: NodeConfigField = {
      id: 'health',
      label: 'Health',
      type: 'select',
      acceptedTypes: ['string'],
      semanticRole: 'status',
      semanticType: 'healthStatus',
      suggestionMode: 'presets',
      supportsVariables: true,
    }
    const priorityField: NodeConfigField = {
      id: 'priority',
      label: 'Priority',
      type: 'select',
      acceptedTypes: ['string'],
      semanticRole: 'priority',
      semanticType: 'priority',
      suggestionMode: 'presets',
      supportsVariables: true,
    }

    expect(
      getContextualFieldSuggestions({
        field: statusField,
        value: '',
        variables,
      }).map((item) => item.label),
    ).toEqual(expect.arrayContaining(['Healthy', 'Needs Attention', 'At Risk']))
    expect(
      getContextualFieldSuggestions({
        field: priorityField,
        value: '',
        variables,
      }).map((item) => item.label),
    ).toEqual(expect.arrayContaining(['Low', 'Medium', 'High', 'Urgent']))
  })

  it('respects suggestionMode none', () => {
    const field: NodeConfigField = {
      id: 'model',
      label: 'Model',
      type: 'text',
      suggestionMode: 'none',
    }
    expect(
      getContextualFieldSuggestions({ field, value: '', variables }),
    ).toEqual([])
  })

  it('uses registry metadata across node families instead of canvas-specific node checks', () => {
    const field = (nodeType: string, fieldId: string) => {
      const definition = getWorkflowNodeDefinition(nodeType)
      expect(definition, nodeType).toBeTruthy()
      const configField = definition?.configFields.find(
        (item) => item.id === fieldId,
      )
      expect(configField, `${nodeType}.${fieldId}`).toBeTruthy()
      return configField as NodeConfigField
    }

    expect(field('send.email', 'recipient')).toMatchObject({
      semanticRole: 'email',
      semanticType: 'emailAddress',
      suggestionMode: 'presetsAndWorkflowData',
    })
    expect(field('send.sms', 'phone')).toMatchObject({
      semanticRole: 'phone',
      semanticType: 'phoneNumber',
      suggestionMode: 'presetsAndWorkflowData',
    })
    expect(field('task.create', 'title')).toMatchObject({
      semanticRole: 'title',
      semanticType: 'taskTitle',
      suggestionMode: 'presetsAndWorkflowData',
    })
    expect(field('client.update', 'nextAction')).toMatchObject({
      semanticType: 'nextAction',
      suggestionMode: 'presets',
    })
    expect(field('wait.delay', 'duration')).toMatchObject({
      semanticType: 'duration',
      suggestionMode: 'workflowData',
    })
    expect(field('condition.branch', 'condition')).toMatchObject({
      semanticType: 'conditionField',
      suggestionMode: 'structured',
    })
    expect(field('ai.llm', 'prompt')).toMatchObject({
      semanticType: 'messageBody',
      suggestionMode: 'presetsAndWorkflowData',
    })
    expect(field('webhook.placeholder', 'body')).toMatchObject({
      semanticType: 'json',
      suggestionMode: 'structured',
    })
  })
})
