import { describe, expect, it } from 'vitest'
import type { Edge, Node } from 'reactflow'

import { validateBuilderWorkflow } from '@/lib/workflows/builderValidation'
import {
  formatDelaySummary,
  normalizeDelayUnit,
} from '@/lib/workflows/delayConfig'
import {
  buildDefaultMappings,
  getCompatibleVariablesForField,
  getRelevantVariablesForField,
  validateNodeConfigVariables,
  validateDataMappings,
  validateVariableValueForField,
  validateWorkflowVariables,
} from '@/lib/workflows/dataMapping'
import { createWorkflowPreflightFailurePreview } from '@/lib/workflows/executionPreview'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'
import { validateWorkflowNodeConfig } from '@/lib/workflows/nodeValidation'
import {
  formatVariableReadableLabel,
  formatVariableSourceLabel,
  getAvailableVariablesForNode,
  resolveVariablePreviewText,
  searchWorkflowVariables,
  workflowVariableRegistry,
} from '@/lib/workflows/variableRegistry'
import { replaceNodeIdsInConfigValue } from '@/lib/workflows/variableTokens'

function node(
  id: string,
  registryId: string,
  label: string,
  data: Record<string, unknown> = {},
): Node {
  return {
    id,
    type: 'webhook',
    position: { x: 0, y: 0 },
    data: {
      __registryNodeId: registryId,
      label,
      ...data,
    },
  } as Node
}

const edge = (source: string, target: string): Edge => ({
  id: `edge-${source}-${target}`,
  source,
  target,
})

describe('workflow variable validation', () => {
  it('validates Delay duration as a positive number and never as email', () => {
    expect(
      validateWorkflowNodeConfig('wait.delay', {
        duration: 30,
        unit: 'minutes',
      }),
    ).toMatchObject({ status: 'ready' })

    for (const duration of ['30 minutes', '24 hours', 0, -1]) {
      const result = validateWorkflowNodeConfig('wait.delay', {
        duration,
        unit: 'minutes',
      })
      expect(result.status).toBe('error')
      expect(
        result.messages.map((message) => message.message).join(' '),
      ).not.toContain('email address')
    }
  })

  it('accepts canonical Delay units and rejects invalid units without email validation', () => {
    for (const unit of ['seconds', 'minutes', 'hours', 'days']) {
      expect(
        validateWorkflowNodeConfig('wait.delay', {
          duration: 30,
          unit,
        }),
      ).toMatchObject({ status: 'ready' })
    }

    const result = validateWorkflowNodeConfig('wait.delay', {
      duration: 30,
      unit: 'not-an-email',
    })

    expect(result.status).toBe('error')
    expect(
      result.messages.map((message) => message.message).join(' '),
    ).not.toContain('email address')
    expect(result.messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'unit' })]),
    )
  })

  it('normalizes Delay units case-insensitively and keeps months unsupported', () => {
    expect(normalizeDelayUnit(' Minutes ')).toBe('minutes')
    expect(normalizeDelayUnit('MINUTES')).toBe('minutes')
    expect(normalizeDelayUnit('m')).toBe('minutes')
    expect(normalizeDelayUnit('Months')).toBeNull()

    expect(
      validateWorkflowNodeConfig('wait.delay', {
        duration: 24,
        unit: ' MINUTES ',
      }),
    ).toMatchObject({ status: 'ready' })

    expect(
      validateWorkflowNodeConfig('wait.delay', {
        duration: 24,
        unit: 'months',
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'error',
        messages: expect.arrayContaining([
          expect.objectContaining({
            field: 'unit',
            message: 'Choose seconds, minutes, hours, or days.',
          }),
        ]),
      }),
    )
  })

  it('formats Delay summaries from canonical duration and unit values', () => {
    expect(formatDelaySummary({ duration: 24, unit: 'seconds' })).toBe(
      'Wait 24 Seconds',
    )
    expect(formatDelaySummary({ duration: 1, unit: 'hours' })).toBe(
      'Wait 1 Hour',
    )
    expect(formatDelaySummary({ duration: 2, unit: 'hours' })).toBe(
      'Wait 2 Hours',
    )
  })

  it('keeps Send Email and Delay validation rules isolated when switching nodes', () => {
    expect(
      validateWorkflowVariables({
        nodes: [
          node('send-email', 'send.email', 'Send Email', {
            recipient: 'not-an-email',
            subject: 'Hello',
            body: 'Hi',
          }),
        ],
        edges: [],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'recipient',
          message: 'Recipient Email is not a valid email address.',
        }),
      ]),
    )

    const delay = validateWorkflowNodeConfig('wait.delay', {
      duration: 30,
      unit: 'minutes',
    })
    expect(delay.status).toBe('ready')
    expect(
      delay.messages.map((message) => message.message).join(' '),
    ).not.toContain('email address')

    expect(
      validateWorkflowVariables({
        nodes: [
          node('send-email', 'send.email', 'Send Email', {
            recipient: 'still-not-email',
            subject: 'Hello',
            body: 'Hi',
          }),
        ],
        edges: [],
      }),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'recipient' })]),
    )
  })

  it('rejects phone variables in email fields', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '{{nodes.lead-created.lead.phone}}',
      subject: 'Follow-up',
      body: 'Hi',
    })
    const issues = validateWorkflowVariables({
      nodes: [lead, email],
      edges: [edge(lead.id, email.id)],
    })

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          nodeId: email.id,
          field: 'recipient',
          message: expect.stringContaining('expects email'),
        }),
      ]),
    )
  })

  it('rejects email variables in phone fields', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const sms = node('send-sms', 'send.sms', 'Send SMS', {
      phone: '{{nodes.lead-created.lead.email}}',
      message: 'Thanks',
    })
    const issues = validateWorkflowVariables({
      nodes: [lead, sms],
      edges: [edge(lead.id, sms.id)],
    })

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          nodeId: sms.id,
          field: 'phone',
          message: expect.stringContaining('expects phone number'),
        }),
      ]),
    )
  })

  it('rejects malformed literal email and phone values', () => {
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: 'not-an-email',
      subject: 'Follow-up',
      body: 'Hi',
    })
    const sms = node('send-sms', 'send.sms', 'Send SMS', {
      phone: 'not-a-phone',
      message: 'Thanks',
    })

    expect(validateWorkflowVariables({ nodes: [email], edges: [] })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Recipient Email is not a valid email address.',
        }),
      ]),
    )
    expect(validateWorkflowVariables({ nodes: [sms], edges: [] })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Recipient Phone is not a valid phone number.',
        }),
      ]),
    )
  })

  it('marks deleted source node tokens as broken', () => {
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '{{nodes.lead-created.lead.email}}',
      subject: 'Follow-up',
      body: 'Hi',
    })
    const issues = validateWorkflowVariables({ nodes: [email], edges: [] })

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('Source step no longer exists'),
        }),
      ]),
    )
  })

  it('immediately invalidates downstream fields when a referenced source node is deleted', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const sms = node('send-sms', 'send.sms', 'Send SMS', {
      phone: '{{nodes.lead-created.lead.phone}}',
      message: 'Thanks',
    })
    const connected = { nodes: [lead, sms], edges: [edge(lead.id, sms.id)] }

    expect(
      validateNodeConfigVariables({ node: sms, ...connected }),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'phone',
          severity: 'error',
        }),
      ]),
    )

    const afterDelete = validateBuilderWorkflow({
      nodes: [sms],
      edges: [],
    })

    expect(afterDelete.nodeResults[sms.id].state).toBe('error')
    expect(afterDelete.publishErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: sms.id,
          field: 'phone',
          message: expect.stringContaining('Source step no longer exists'),
        }),
      ]),
    )
  })

  it('marks node tokens unavailable when the previous-step edge is deleted', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '{{nodes.lead-created.lead.email}}',
      subject: 'Follow-up',
      body: 'Hi',
    })
    const issues = validateWorkflowVariables({
      nodes: [lead, email],
      edges: [],
    })

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('no longer connected before'),
        }),
      ]),
    )
  })

  it('shows compatible friendly previous-step values without duplicate raw-token options', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const sms = node('send-sms', 'send.sms', 'Send SMS', {
      phone: '',
      message: 'Thanks',
    })
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '',
      subject: 'Follow-up',
      body: 'Hi',
    })
    const smsVariables = getAvailableVariablesForNode(sms, {
      nodes: [lead, sms],
      edges: [edge(lead.id, sms.id)],
    })
    const emailVariables = getAvailableVariablesForNode(email, {
      nodes: [lead, email],
      edges: [edge(lead.id, email.id)],
    })
    const smsPhoneField = getWorkflowNodeDefinition(
      'send.sms',
    )?.configFields.find((field) => (field.key ?? field.id) === 'phone')
    const emailRecipientField = getWorkflowNodeDefinition(
      'send.email',
    )?.configFields.find((field) => (field.key ?? field.id) === 'recipient')

    expect(smsPhoneField).toBeDefined()
    expect(emailRecipientField).toBeDefined()

    const phoneOptions = getCompatibleVariablesForField({
      field: smsPhoneField!,
      variables: smsVariables,
    })
    const emailOptions = getCompatibleVariablesForField({
      field: emailRecipientField!,
      variables: emailVariables,
    })
    const phoneLabels = phoneOptions.map(formatVariableReadableLabel)
    const emailLabels = emailOptions.map(formatVariableReadableLabel)

    expect(phoneLabels).toContain('Lead Phone')
    expect(phoneOptions.map((item) => item.token)).toContain(
      '{{nodes.lead-created.lead.phone}}',
    )
    expect(
      phoneOptions.some(
        (item) => item.key === '{{nodes.lead-created.lead.phone}}',
      ),
    ).toBe(false)
    expect(phoneOptions.map((item) => item.token)).not.toContain(
      '{{nodes.lead-created.lead.email}}',
    )

    expect(emailLabels).toContain('Lead Email')
    expect(emailOptions.map((item) => item.token)).toContain(
      '{{nodes.lead-created.lead.email}}',
    )
    expect(
      emailOptions.some(
        (item) => item.key === '{{nodes.lead-created.lead.email}}',
      ),
    ).toBe(false)
    expect(emailOptions.map((item) => item.token)).not.toContain(
      '{{nodes.lead-created.lead.phone}}',
    )
  })

  it('uses entity-aware friendly labels for registry variables without exposing raw tokens', () => {
    const labelsByKey = new Map(
      workflowVariableRegistry.map((variable) => [
        variable.key,
        formatVariableReadableLabel(variable),
      ]),
    )

    expect(labelsByKey.get('lead.phone')).toBe('Lead Phone')
    expect(labelsByKey.get('client.phone')).toBe('Client Phone')
    expect(labelsByKey.get('contact.phone')).toBe('Contact Phone')
    expect(labelsByKey.get('lead.email')).toBe('Lead Email')
    expect(labelsByKey.get('client.email')).toBe('Client Email')
    expect(labelsByKey.get('workspace.phone')).toBe('Workspace Phone')
    expect(labelsByKey.get('workspace.email')).toBe('Workspace Email')
    expect(
      [...labelsByKey.values()].some((label) => label.includes('{{')),
    ).toBe(false)
    expect(
      formatVariableSourceLabel(
        workflowVariableRegistry.find(
          (variable) => variable.key === 'automation.current_time',
        )!,
      ),
    ).toBe('Workflow')
  })

  it('adds readable source qualifiers when duplicate workflow labels collide', () => {
    const firstLead = node('lead-a', 'lead.created', 'Lead Created')
    const secondLead = node('lead-b', 'lead.created', 'Lead Created')
    const sms = node('send-sms', 'send.sms', 'Send SMS')
    const smsPhoneField = getWorkflowNodeDefinition(
      'send.sms',
    )?.configFields.find((field) => (field.key ?? field.id) === 'phone')
    expect(smsPhoneField).toBeDefined()

    const options = getCompatibleVariablesForField({
      field: smsPhoneField!,
      variables: getAvailableVariablesForNode(sms, {
        nodes: [firstLead, secondLead, sms],
        edges: [edge(firstLead.id, sms.id), edge(secondLead.id, sms.id)],
      }),
    })
    const leadPhoneLabels = options
      .filter((item) => item.path === 'lead.phone')
      .map(formatVariableReadableLabel)

    expect(leadPhoneLabels).toEqual([
      'Lead Phone (Lead Created 1)',
      'Lead Phone (Lead Created 2)',
    ])
    expect(
      leadPhoneLabels.some(
        (label) => label.includes('lead-a') || label.includes('lead-b'),
      ),
    ).toBe(false)
  })

  it('offers compatible previous-step and workspace email values for email recipients', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '',
      subject: 'Follow-up',
      body: 'Hi',
    })
    const emailRecipientField = getWorkflowNodeDefinition(
      'send.email',
    )?.configFields.find((field) => (field.key ?? field.id) === 'recipient')
    expect(emailRecipientField).toBeDefined()

    const variables = getAvailableVariablesForNode(email, {
      nodes: [lead, email],
      edges: [edge(lead.id, email.id)],
    })
    const options = getCompatibleVariablesForField({
      field: emailRecipientField!,
      variables,
    })
    const labels = options.map(formatVariableReadableLabel)

    expect(labels).toEqual(
      expect.arrayContaining([
        'Lead Email',
        'Workspace Email',
        'Support Email',
        'Owner Email',
      ]),
    )
    expect(options.map((item) => item.key)).toContain('workspace.supportEmail')
    expect(options.map((item) => item.key)).not.toContain(
      'nodes.lead-created.lead.phone',
    )
  })

  it('filters recipient email suggestions to email-relevant workflow and workspace data', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email')
    const recipientField = getWorkflowNodeDefinition(
      'send.email',
    )?.configFields.find((field) => (field.key ?? field.id) === 'recipient')
    expect(recipientField).toBeDefined()

    const variables = getAvailableVariablesForNode(email, {
      nodes: [lead, email],
      edges: [edge(lead.id, email.id)],
    })
    const options = getRelevantVariablesForField({
      field: recipientField!,
      variables,
    })
    const keys = options.map((item) => item.key)

    expect(keys).toEqual(
      expect.arrayContaining([
        'nodes.lead-created.lead.email',
        'workspace.email',
        'workspace.supportEmail',
        'owner.email',
      ]),
    )
    expect(keys).not.toContain('nodes.lead-created.lead.phone')
    expect(keys).not.toContain('nodes.lead-created.lead.id')
    expect(keys).not.toContain('automation.run_id')
    expect(keys).not.toContain('workspace.slug')
  })

  it('offers compatible phone values without showing email values for phone recipients', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const sms = node('send-sms', 'send.sms', 'Send SMS')
    const smsPhoneField = getWorkflowNodeDefinition(
      'send.sms',
    )?.configFields.find((field) => (field.key ?? field.id) === 'phone')
    expect(smsPhoneField).toBeDefined()

    const variables = getAvailableVariablesForNode(sms, {
      nodes: [lead, sms],
      edges: [edge(lead.id, sms.id)],
    })
    const options = getCompatibleVariablesForField({
      field: smsPhoneField!,
      variables,
    })

    expect(options.map(formatVariableReadableLabel)).toContain('Lead Phone')
    expect(options.map((item) => item.key)).toContain('workspace.phone')
    expect(options.map((item) => item.key)).not.toContain(
      'nodes.lead-created.lead.email',
    )
    expect(options.map((item) => item.key)).not.toContain('workspace.email')
  })

  it('filters phone suggestions to phone-relevant values', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const sms = node('send-sms', 'send.sms', 'Send SMS')
    const phoneField = getWorkflowNodeDefinition('send.sms')?.configFields.find(
      (field) => (field.key ?? field.id) === 'phone',
    )
    expect(phoneField).toBeDefined()

    const options = getRelevantVariablesForField({
      field: phoneField!,
      variables: getAvailableVariablesForNode(sms, {
        nodes: [lead, sms],
        edges: [edge(lead.id, sms.id)],
      }),
    })
    const keys = options.map((item) => item.key)

    expect(keys).toContain('nodes.lead-created.lead.phone')
    expect(keys).toContain('workspace.phone')
    expect(keys).not.toContain('nodes.lead-created.lead.email')
    expect(keys).not.toContain('workspace.email')
  })

  it('hides generic IDs, slugs, timestamps, phones, and emails from subject suggestions', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const sms = node('send-sms', 'send.sms', 'Send SMS')
    const email = node('send-email', 'send.email', 'Send Email')
    const subjectField = getWorkflowNodeDefinition(
      'send.email',
    )?.configFields.find((field) => (field.key ?? field.id) === 'subject')
    expect(subjectField).toBeDefined()

    const options = getRelevantVariablesForField({
      field: subjectField!,
      variables: getAvailableVariablesForNode(email, {
        nodes: [lead, sms, email],
        edges: [edge(lead.id, sms.id), edge(sms.id, email.id)],
      }),
    })
    const keys = options.map((item) => item.key)

    expect(keys).toEqual(
      expect.arrayContaining([
        'nodes.lead-created.lead.fullName',
        'nodes.lead-created.lead.company',
        'workspace.name',
      ]),
    )
    expect(keys).not.toContain('nodes.sms.message.id')
    expect(keys).not.toContain('nodes.send-sms.message.id')
    expect(keys).not.toContain('automation.run_id')
    expect(keys).not.toContain('workspace.slug')
    expect(keys).not.toContain('nodes.lead-created.lead.phone')
    expect(keys).not.toContain('nodes.lead-created.lead.email')
  })

  it('keeps body suggestions useful for mixed text without exposing internal IDs', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const sms = node('send-sms', 'send.sms', 'Send SMS')
    const email = node('send-email', 'send.email', 'Send Email')
    const bodyField = getWorkflowNodeDefinition(
      'send.email',
    )?.configFields.find((field) => (field.key ?? field.id) === 'body')
    expect(bodyField).toBeDefined()

    const options = getRelevantVariablesForField({
      field: bodyField!,
      variables: getAvailableVariablesForNode(email, {
        nodes: [lead, sms, email],
        edges: [edge(lead.id, sms.id), edge(sms.id, email.id)],
      }),
    })
    const keys = options.map((item) => item.key)

    expect(keys).toEqual(
      expect.arrayContaining([
        'nodes.lead-created.lead.fullName',
        'nodes.lead-created.lead.email',
        'nodes.lead-created.lead.phone',
        'workspace.name',
        'workspace.supportEmail',
      ]),
    )
    expect(keys).not.toContain('nodes.send-sms.message.id')
    expect(keys).not.toContain('automation.run_id')
    expect(keys).not.toContain('workspace.slug')
  })

  it('builds semantic default mappings without filling unrelated text fields', () => {
    const sms = node('send-sms', 'send.sms', 'Send SMS')
    const email = node('send-email', 'send.email', 'Send Email')
    const mappings = buildDefaultMappings({ source: sms, target: email })

    expect(
      mappings.find((mapping) => mapping.target === 'recipient')?.mode,
    ).toBe('text')
    expect(
      mappings.find((mapping) => mapping.target === 'subject'),
    ).toMatchObject({
      mode: 'text',
      value: '',
    })
    expect(mappings.find((mapping) => mapping.target === 'body')).toMatchObject(
      {
        mode: 'text',
        value: '',
      },
    )
  })

  it('filters unified field selector options to values compatible with the destination field', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const sms = node('send-sms', 'send.sms', 'Send SMS')
    const email = node('send-email', 'send.email', 'Send Email')
    const recipientField = getWorkflowNodeDefinition(
      'send.email',
    )?.configFields.find((field) => (field.key ?? field.id) === 'recipient')
    const phoneField = getWorkflowNodeDefinition('send.sms')?.configFields.find(
      (field) => (field.key ?? field.id) === 'phone',
    )
    expect(recipientField).toBeDefined()
    expect(phoneField).toBeDefined()

    const emailOptions = getCompatibleVariablesForField({
      field: recipientField!,
      variables: getAvailableVariablesForNode(email, {
        nodes: [lead, email],
        edges: [edge(lead.id, email.id)],
      }),
    }).map((item) => item.key)

    const phoneOptions = getCompatibleVariablesForField({
      field: phoneField!,
      variables: getAvailableVariablesForNode(sms, {
        nodes: [lead, sms],
        edges: [edge(lead.id, sms.id)],
      }),
    }).map((item) => item.key)

    expect(emailOptions).toContain('nodes.lead-created.lead.email')
    expect(emailOptions).not.toContain('nodes.lead-created.lead.phone')
    expect(phoneOptions).toContain('nodes.lead-created.lead.phone')
    expect(phoneOptions).not.toContain('nodes.lead-created.lead.email')
  })

  it('validates dynamic values directly from node config as the mapping source of truth', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '{{nodes.lead-created.lead.email}}',
      subject: 'Quick follow-up',
      body: 'Hi {{nodes.lead-created.lead.fullName}}',
    })
    const recipientField = getWorkflowNodeDefinition(
      'send.email',
    )?.configFields.find((field) => (field.key ?? field.id) === 'recipient')
    expect(recipientField).toBeDefined()

    expect(
      validateVariableValueForField({
        value: email.data.recipient,
        field: recipientField!,
        targetNode: email,
        nodes: [lead, email],
        edges: [edge(lead.id, email.id)],
      }),
    ).toEqual([])

    expect(
      resolveVariablePreviewText(
        email.data.body,
        getAvailableVariablesForNode(email, {
          nodes: [lead, email],
          edges: [edge(lead.id, email.id)],
        }),
      ),
    ).toContain('John Rivera')
  })

  it('applies metadata-driven mapping behavior across CRM, task, condition, webhook, and AI fields', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const crm = node('crm-action', 'crm.action', 'CRM Action', {
      objectType: 'CONTACT',
      action: 'contact.update',
    })
    const task = node('task-create', 'task.create', 'Create Task', {
      title: '{{nodes.lead-created.lead.fullName}} follow-up',
      priority: 'Medium',
    })
    const condition = node(
      'condition',
      'condition.branch',
      'Condition / Branch',
      {
        condition: '{{nodes.lead-created.lead.status}} == "New"',
      },
    )
    const webhook = node('webhook', 'webhook.placeholder', 'Webhook', {
      url: '{{workspace.website}}',
      method: 'POST',
      outputMode: 'JSON',
      body: '{ "lead": "{{nodes.lead-created.lead.email}}" }',
    })
    const ai = node('ai-reply', 'ai.generate_response', 'AI Reply', {
      prompt:
        'Draft a reply to {{nodes.lead-created.lead.fullName}} about {{nodes.lead-created.lead.company}}.',
      model: 'gpt-4.1-mini',
      tone: 'Professional',
      temperature: 0.2,
    })
    const graph = {
      nodes: [lead, crm, task, condition, webhook, ai],
      edges: [
        edge(lead.id, crm.id),
        edge(lead.id, task.id),
        edge(lead.id, condition.id),
        edge(lead.id, webhook.id),
        edge(lead.id, ai.id),
      ],
    }

    expect(validateNodeConfigVariables({ node: crm, ...graph })).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'objectType' }),
      ]),
    )
    expect(validateNodeConfigVariables({ node: task, ...graph })).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'title', severity: 'error' }),
      ]),
    )
    expect(
      validateNodeConfigVariables({ node: condition, ...graph }),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'condition', severity: 'error' }),
      ]),
    )
    expect(
      validateNodeConfigVariables({ node: webhook, ...graph }),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'url', severity: 'error' }),
      ]),
    )
    expect(validateNodeConfigVariables({ node: ai, ...graph })).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'prompt', severity: 'error' }),
      ]),
    )

    const taskTitle = getWorkflowNodeDefinition(
      'task.create',
    )?.configFields.find((field) => (field.key ?? field.id) === 'title')
    const webhookUrl = getWorkflowNodeDefinition(
      'webhook.placeholder',
    )?.configFields.find((field) => (field.key ?? field.id) === 'url')
    const aiPrompt = getWorkflowNodeDefinition(
      'ai.generate_response',
    )?.configFields.find((field) => (field.key ?? field.id) === 'prompt')
    expect(taskTitle).toBeDefined()
    expect(webhookUrl).toBeDefined()
    expect(aiPrompt).toBeDefined()

    const taskOptions = getRelevantVariablesForField({
      field: taskTitle!,
      variables: getAvailableVariablesForNode(task, graph),
    }).map((item) => item.key)
    const webhookOptions = getCompatibleVariablesForField({
      field: webhookUrl!,
      variables: getAvailableVariablesForNode(webhook, graph),
    }).map((item) => item.key)
    const aiOptions = getRelevantVariablesForField({
      field: aiPrompt!,
      variables: getAvailableVariablesForNode(ai, graph),
    }).map((item) => item.key)

    expect(taskOptions).toContain('nodes.lead-created.lead.fullName')
    expect(webhookOptions).toContain('workspace.website')
    expect(webhookOptions).not.toContain('nodes.lead-created.lead.email')
    expect(aiOptions).toEqual(
      expect.arrayContaining([
        'nodes.lead-created.lead.fullName',
        'nodes.lead-created.lead.email',
        'workspace.supportEmail',
      ]),
    )
  })

  it('detects deleted source references for several downstream node families', () => {
    const task = node('task-create', 'task.create', 'Create Task', {
      title: 'Follow up with {{nodes.lead-created.lead.fullName}}',
    })
    const webhook = node('webhook', 'webhook.placeholder', 'Webhook', {
      url: 'https://example.com/{{nodes.lead-created.lead.id}}',
      method: 'POST',
      outputMode: 'JSON',
      body: '{ "email": "{{nodes.lead-created.lead.email}}" }',
    })
    const ai = node('ai-reply', 'ai.generate_response', 'AI Reply', {
      prompt: 'Reply to {{nodes.lead-created.lead.fullName}}',
      model: 'gpt-4.1-mini',
      tone: 'Professional',
      temperature: 0.2,
    })
    const issues = validateWorkflowVariables({
      nodes: [task, webhook, ai],
      edges: [],
    })

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: task.id,
          field: 'title',
          status: 'broken-source',
        }),
        expect.objectContaining({
          nodeId: webhook.id,
          field: 'url',
          status: 'broken-source',
        }),
        expect.objectContaining({
          nodeId: ai.id,
          field: 'prompt',
          status: 'broken-source',
        }),
      ]),
    )
  })

  it('searches friendly workflow and workspace labels across node families', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email')
    const recipientField = getWorkflowNodeDefinition(
      'send.email',
    )?.configFields.find((field) => (field.key ?? field.id) === 'recipient')
    expect(recipientField).toBeDefined()
    const options = searchWorkflowVariables(
      'email',
      getCompatibleVariablesForField({
        field: recipientField!,
        variables: getAvailableVariablesForNode(email, {
          nodes: [lead, email],
          edges: [edge(lead.id, email.id)],
        }),
      }),
    )
    const labels = options.map(formatVariableReadableLabel)

    expect(labels).toEqual(
      expect.arrayContaining([
        'Lead Email',
        'Workspace Email',
        'Support Email',
        'Owner Email',
      ]),
    )
    expect(options.map((item) => item.token)).toContain(
      '{{nodes.lead-created.lead.email}}',
    )
    expect(labels.some((label) => label.includes('{{'))).toBe(false)
  })

  it('builds Delay Data Links from numeric duration and unit defaults, not SMS outputs', () => {
    const sms = node('send-sms', 'send.sms', 'Send SMS')
    const delay = node('wait-delay', 'wait.delay', 'Wait / Delay', {
      duration: 30,
      unit: 'minutes',
    })
    const mappings = buildDefaultMappings({ source: sms, target: delay })

    expect(
      mappings.find((mapping) => mapping.target === 'duration'),
    ).toMatchObject({
      mode: 'text',
      value: '30',
    })
    expect(mappings.find((mapping) => mapping.target === 'unit')).toMatchObject(
      {
        mode: 'text',
        value: 'minutes',
      },
    )
    expect(
      mappings.find((mapping) => mapping.target === 'duration')?.source,
    ).toBeUndefined()
    expect(
      mappings.find((mapping) => mapping.target === 'unit')?.source,
    ).toBeUndefined()
  })

  it('uses canonical Delay config values when building Data Links defaults', () => {
    const sms = node('send-sms', 'send.sms', 'Send SMS')
    const delay = node('wait-delay', 'wait.delay', 'Wait / Delay', {
      duration: 24,
      unit: ' Seconds ',
    })
    const mappings = buildDefaultMappings({ source: sms, target: delay })

    expect(
      mappings.find((mapping) => mapping.target === 'duration'),
    ).toMatchObject({
      mode: 'text',
      value: '24',
    })
    expect(mappings.find((mapping) => mapping.target === 'unit')).toMatchObject(
      {
        mode: 'text',
        value: 'seconds',
      },
    )
  })

  it('filters incompatible SMS outputs from Delay Duration but allows numeric upstream values', () => {
    const opportunity = node(
      'opportunity-changed',
      'opportunity.stage_changed',
      'Opportunity Stage Changed',
    )
    const sms = node('send-sms', 'send.sms', 'Send SMS')
    const delay = node('wait-delay', 'wait.delay', 'Wait / Delay')
    const durationField = getWorkflowNodeDefinition(
      'wait.delay',
    )?.configFields.find((field) => (field.key ?? field.id) === 'duration')
    expect(durationField).toBeDefined()

    const smsOptions = getRelevantVariablesForField({
      field: durationField!,
      variables: getAvailableVariablesForNode(delay, {
        nodes: [sms, delay],
        edges: [edge(sms.id, delay.id)],
      }),
    }).map((item) => item.key)

    expect(smsOptions).not.toContain('nodes.send-sms.message.id')
    expect(smsOptions).not.toContain('nodes.send-sms.message.status')
    expect(smsOptions).not.toContain('nodes.send-sms.recipient.phone')

    const numericOptions = getRelevantVariablesForField({
      field: durationField!,
      variables: getAvailableVariablesForNode(delay, {
        nodes: [opportunity, delay],
        edges: [edge(opportunity.id, delay.id)],
      }),
    }).map((item) => item.key)

    expect(numericOptions).toContain(
      'nodes.opportunity-changed.opportunity.revenue',
    )
  })

  it('filters option-backed Delay Unit values through allowed options instead of generic strings', () => {
    const sms = node('send-sms', 'send.sms', 'Send SMS')
    const delay = node('wait-delay', 'wait.delay', 'Wait / Delay')
    const unitField = getWorkflowNodeDefinition(
      'wait.delay',
    )?.configFields.find((field) => (field.key ?? field.id) === 'unit')
    expect(unitField).toBeDefined()

    const options = getCompatibleVariablesForField({
      field: unitField!,
      variables: getAvailableVariablesForNode(delay, {
        nodes: [sms, delay],
        edges: [edge(sms.id, delay.id)],
      }),
    }).map((item) => item.key)

    expect(options).not.toContain('automation.run_id')
    expect(options).not.toContain('automation.workspace')
    expect(options).not.toContain('nodes.send-sms.message.id')
    expect(options).not.toContain('nodes.send-sms.message.status')
    expect(options).not.toContain('workspace.name')
  })

  it('allows enum-like workflow values for option-backed fields when sample values match options', () => {
    const sourceTask = node('source-task', 'task.create', 'Create Task')
    const targetTask = node('target-task', 'task.create', 'Create Task', {
      title: 'Review lead',
      status: '{{nodes.source-task.task.status}}',
    })
    const statusField = getWorkflowNodeDefinition(
      'task.create',
    )?.configFields.find((field) => (field.key ?? field.id) === 'status')
    expect(statusField).toBeDefined()

    const options = getCompatibleVariablesForField({
      field: statusField!,
      variables: getAvailableVariablesForNode(targetTask, {
        nodes: [sourceTask, targetTask],
        edges: [edge(sourceTask.id, targetTask.id)],
      }),
    }).map((item) => item.key)

    expect(options).toContain('nodes.source-task.task.status')
    expect(options).not.toContain('nodes.source-task.task.title')

    expect(
      validateVariableValueForField({
        value: '{{nodes.source-task.task.status}}',
        field: statusField!,
        targetNode: targetTask,
        nodes: [sourceTask, targetTask],
        edges: [edge(sourceTask.id, targetTask.id)],
      }),
    ).toEqual([])
  })

  it('validates Delay Data Links custom values consistently with inspector validation', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const delay = node('wait-delay', 'wait.delay', 'Wait / Delay')
    const connection = edge(lead.id, delay.id)

    expect(
      validateDataMappings({
        edge: {
          ...connection,
          data: {
            mappings: [
              { target: 'duration', mode: 'text', value: '30' },
              { target: 'unit', mode: 'text', value: 'minutes' },
            ],
          },
        },
        source: lead,
        target: delay,
        nodes: [lead, delay],
        edges: [connection],
      }),
    ).toEqual([])

    expect(
      validateDataMappings({
        edge: {
          ...connection,
          data: {
            mappings: [
              { target: 'duration', mode: 'text', value: '30 minutes' },
              { target: 'unit', mode: 'text', value: 'minutes' },
            ],
          },
        },
        source: lead,
        target: delay,
        nodes: [lead, delay],
        edges: [connection],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'duration', severity: 'error' }),
      ]),
    )

    expect(
      validateDataMappings({
        edge: {
          ...connection,
          data: {
            mappings: [
              { target: 'duration', mode: 'text', value: '30' },
              { target: 'unit', mode: 'text', value: 'fortnights' },
            ],
          },
        },
        source: lead,
        target: delay,
        nodes: [lead, delay],
        edges: [connection],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'unit', severity: 'error' }),
      ]),
    )
  })

  it('keeps a valid Send Email node ready despite unrelated workflow warnings', () => {
    const trigger = node('lead-created', 'lead.created', 'Lead Created')
    const sms = node('send-sms', 'send.sms', 'Send SMS', {
      phone: '{{nodes.lead-created.lead.phone}}',
      message: 'Thanks for reaching out.',
    })
    const delay = node('wait-delay', 'wait.delay', 'Wait / Delay', {
      duration: 24,
      unit: 'seconds',
    })
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '{{nodes.lead-created.lead.email}}',
      subject: 'Quick follow-up',
      body: 'Hi, thanks for contacting us.',
      from: 'Workspace default',
      cc: '',
    })
    const unrelated = node('unrelated-task', 'task.create', 'Create Task', {
      title: 'Review later',
      priority: 'Medium',
    })
    const validation = validateBuilderWorkflow({
      nodes: [trigger, sms, delay, email, unrelated],
      edges: [
        edge(trigger.id, sms.id),
        edge(sms.id, delay.id),
        edge(delay.id, email.id),
      ],
    })

    expect(validation.nodeResults[email.id].state).toBe('ready')
    expect(validation.nodeResults[email.id].messages).toEqual([])
    expect(validation.nodeResults[unrelated.id].state).toBe('disconnected')
  })

  it('marks Send Email Needs Review only for node-scoped warnings and clears immediately', () => {
    const emailWithSuggestion = node('send-email', 'send.email', 'Send Email', {
      recipient: 'email',
      subject: 'Quick follow-up',
      body: 'Hi',
    })
    const warningValidation = validateBuilderWorkflow({
      nodes: [emailWithSuggestion],
      edges: [],
    })

    expect(warningValidation.nodeResults[emailWithSuggestion.id].state).toBe(
      'warning',
    )
    expect(
      warningValidation.nodeResults[emailWithSuggestion.id].messages,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'recipient',
          message: expect.stringContaining('Customer Email'),
        }),
      ]),
    )

    const fixedEmail = node('send-email', 'send.email', 'Send Email', {
      recipient: 'owner@example.com',
      subject: 'Quick follow-up',
      body: 'Hi',
    })
    const readyValidation = validateBuilderWorkflow({
      nodes: [fixedEmail],
      edges: [],
    })

    expect(readyValidation.nodeResults[fixedEmail.id].state).toBe('ready')
    expect(readyValidation.nodeResults[fixedEmail.id].messages).toEqual([])
  })

  it('auto-maps Lead Created to Send Email recipient with Lead Email only', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email')
    const mappings = buildDefaultMappings({ source: lead, target: email })

    expect(
      mappings.find((mapping) => mapping.target === 'recipient'),
    ).toMatchObject({
      mode: 'variable',
      source: 'nodes.lead-created.lead.email',
    })
    expect(
      mappings.find((mapping) => mapping.target === 'subject'),
    ).toMatchObject({
      mode: 'text',
      value: '',
    })
    expect(mappings.find((mapping) => mapping.target === 'body')).toMatchObject(
      {
        mode: 'text',
        value: '',
      },
    )
  })

  it('auto-maps missed-call CRM phone data to Send SMS phone', () => {
    const missedCall = node(
      'missed-call',
      'crm.trigger',
      'Missed Call Logged',
      {
        event: 'missed_call.logged',
      },
    )
    const sms = node('send-sms', 'send.sms', 'Send SMS')
    const mappings = buildDefaultMappings({ source: missedCall, target: sms })

    expect(
      mappings.find((mapping) => mapping.target === 'phone'),
    ).toMatchObject({
      mode: 'variable',
      source: 'nodes.missed-call.record.phone',
    })
  })

  it('preserves existing user-written body text instead of overwriting it', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email', {
      body: 'Hi {{nodes.lead-created.lead.fullName}}, your estimate is ready.',
    })
    const mappings = buildDefaultMappings({ source: lead, target: email })

    expect(mappings.find((mapping) => mapping.target === 'body')).toMatchObject(
      {
        mode: 'text',
        value:
          'Hi {{nodes.lead-created.lead.fullName}}, your estimate is ready.',
      },
    )
  })

  it('validates fixed email values and blocks invalid fixed literals', () => {
    const validEmail = node('send-email', 'send.email', 'Send Email', {
      recipient: 'support@company.com',
      subject: 'Follow-up',
      body: 'Hi',
    })
    const invalidEmail = node('send-email', 'send.email', 'Send Email', {
      recipient: 'not-an-email',
      subject: 'Follow-up',
      body: 'Hi',
    })

    expect(
      validateWorkflowVariables({ nodes: [validEmail], edges: [] }),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'recipient', severity: 'error' }),
      ]),
    )
    expect(
      validateWorkflowVariables({ nodes: [invalidEmail], edges: [] }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'recipient', severity: 'error' }),
      ]),
    )
  })

  it('allows optional mappings to stay unset while required mappings warn clearly', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email')
    const connection = edge(lead.id, email.id)
    const issues = validateDataMappings({
      edge: {
        ...connection,
        data: {
          mappings: [
            { target: 'recipient', mode: 'text', value: '' },
            { target: 'cc', mode: 'text', value: '' },
          ],
        },
      },
      source: lead,
      target: email,
      nodes: [lead, email],
      edges: [connection],
    })

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'recipient',
          message:
            'Recipient Email has not been mapped. Choose workflow data or enter a custom value.',
        }),
      ]),
    )
    expect(issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'cc' })]),
    )
  })

  it('keeps workspace data mappings valid and preserves canonical and literal values on save', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email')
    const connection = edge(lead.id, email.id)
    const mappedEdge = {
      ...connection,
      data: {
        mappings: [
          {
            target: 'recipient',
            mode: 'variable' as const,
            source: 'workspace.supportEmail',
          },
          {
            target: 'subject',
            mode: 'text' as const,
            value: 'Your estimate is ready',
          },
        ],
      },
    }

    expect(
      validateDataMappings({
        edge: mappedEdge,
        source: lead,
        target: email,
        nodes: [lead, email],
        edges: [connection],
      }),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'recipient', severity: 'error' }),
      ]),
    )

    const saved = JSON.stringify({
      nodes: [
        lead,
        node('send-email', 'send.email', 'Send Email', {
          recipient: '{{workspace.supportEmail}}',
          subject: 'Your estimate is ready',
          body: 'Hi',
        }),
      ],
      edges: [mappedEdge],
    })
    const reloaded = JSON.parse(saved) as { nodes: Node[]; edges: Edge[] }

    expect(reloaded.nodes[1].data.recipient).toBe('{{workspace.supportEmail}}')
    expect(reloaded.nodes[1].data.subject).toBe('Your estimate is ready')
  })

  it('marks canonical tokens broken when the source output path no longer exists', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '{{nodes.lead-created.lead.missingEmail}}',
      subject: 'Follow-up',
      body: 'Hi',
    })
    const issues = validateWorkflowVariables({
      nodes: [lead, email],
      edges: [edge(lead.id, email.id)],
    })

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringContaining('no longer provides'),
        }),
      ]),
    )
  })

  it('keeps workspace variables valid without graph nodes', () => {
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '{{workspace.email}}',
      cc: '{{owner.email}}',
      subject: 'Follow-up',
      body: 'Hi',
    })

    const messages = validateWorkflowVariables({
      nodes: [email],
      edges: [],
    }).map((issue) => issue.message)

    expect(messages.join(' ')).not.toContain('Variable source no longer exists')
    expect(messages.join(' ')).not.toContain('workspace.email')
    expect(messages.join(' ')).not.toContain('owner.email')
  })

  it('resolves supported legacy aliases without treating them as node IDs', () => {
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '{{client.email}}',
      cc: '{{owner.email}}',
      subject: 'Follow-up',
      body: 'Hi {{client.name}}',
    })

    const messages = validateWorkflowVariables({
      nodes: [email],
      edges: [],
    }).map((issue) => issue.message)

    expect(messages.join(' ')).not.toContain('Variable source no longer exists')
    expect(messages.join(' ')).not.toContain('client.email')
    expect(messages.join(' ')).not.toContain('owner.email')
  })

  it('reports unsupported aliases as unavailable, not deleted nodes', () => {
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '{{unknown.email}}',
      subject: 'Follow-up',
      body: 'Hi',
    })

    expect(validateWorkflowVariables({ nodes: [email], edges: [] })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'This variable is not available in the current workflow.',
        }),
      ]),
    )
  })

  it('validates every embedded token in mixed text and resolves preview values', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '{{nodes.lead-created.lead.email}}',
      subject: 'Hello {{nodes.lead-created.lead.fullName}}',
      body: 'Hi {{nodes.deleted.lead.fullName}}, thanks.',
    })
    const graph = { nodes: [lead, email], edges: [edge(lead.id, email.id)] }
    const issues = validateWorkflowVariables(graph)
    const variables = getAvailableVariablesForNode(email, graph)

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'body',
          message: expect.stringContaining('Source step no longer exists'),
        }),
      ]),
    )
    expect(
      resolveVariablePreviewText(
        'Hello {{nodes.lead-created.lead.fullName}}',
        variables,
      ),
    ).toBe('Hello John Rivera')
  })

  it('groups preview validation failures by affected node and deduplicates messages', () => {
    const issues = [
      {
        id: 'a',
        severity: 'error' as const,
        nodeId: 'send-email',
        message:
          'Recipient Email expects email, but Lead Phone provides phone number.',
      },
      {
        id: 'b',
        severity: 'error' as const,
        nodeId: 'send-email',
        message:
          'Recipient Email expects email, but Lead Phone provides phone number.',
      },
      {
        id: 'c',
        severity: 'error' as const,
        message: 'Missing trigger.',
      },
    ]
    const execution = createWorkflowPreflightFailurePreview({
      automationId: 'automation',
      workspaceId: 'workspace',
      issues,
      nodes: [node('send-email', 'send.email', 'Send Email')],
      edges: [],
    })

    expect(execution.steps).toHaveLength(2)
    expect(execution.steps[0].logs).toHaveLength(1)
    expect(execution.summary?.failed).toBe(2)
    expect(execution.summary?.errors).toBe(3)
  })

  it('preserves canonical mapping values and rejects incompatible edge mappings', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email')
    const connection = edge(lead.id, email.id)
    const mappings = buildDefaultMappings({ source: lead, target: email })
    const recipient = mappings.find((mapping) => mapping.target === 'recipient')

    expect(recipient?.source).toBe('nodes.lead-created.lead.email')
    expect(
      validateDataMappings({
        edge: {
          ...connection,
          data: {
            mappings: [
              {
                target: 'recipient',
                mode: 'variable',
                source: 'nodes.lead-created.lead.phone',
              },
            ],
          },
        },
        source: lead,
        target: email,
        nodes: [lead, email],
        edges: [connection],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'incompatible',
        }),
      ]),
    )
  })

  it('builder validation blocks preview/publish for incompatible variables', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '{{nodes.lead-created.lead.phone}}',
      subject: 'Follow-up',
      body: 'Hi',
    })
    const validation = validateBuilderWorkflow({
      nodes: [lead, email],
      edges: [edge(lead.id, email.id)],
    })

    expect(validation.canPublish).toBe(false)
    expect(validation.publishErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: email.id,
          message: expect.stringContaining('expects email'),
        }),
      ]),
    )
  })

  it('copy and paste remaps internal node variable tokens', () => {
    const remapped = replaceNodeIdsInConfigValue(
      {
        recipient: '{{nodes.lead-created.lead.email}}',
        body: 'Hi {{nodes.lead-created.lead.fullName}}',
      },
      new Map([['lead-created', 'lead-created-copy']]),
    )

    expect(remapped).toEqual({
      recipient: '{{nodes.lead-created-copy.lead.email}}',
      body: 'Hi {{nodes.lead-created-copy.lead.fullName}}',
    })
  })

  it('save and reload round-trips canonical mappings and validation state', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const email = node('send-email', 'send.email', 'Send Email', {
      recipient: '{{nodes.lead-created.lead.email}}',
      subject: 'Follow-up',
      body: 'Hi {{nodes.lead-created.lead.fullName}}',
    })
    const saved = JSON.stringify({
      nodes: [lead, email],
      edges: [edge(lead.id, email.id)],
    })
    const reloaded = JSON.parse(saved) as { nodes: Node[]; edges: Edge[] }

    expect(reloaded.nodes[1].data.recipient).toBe(
      '{{nodes.lead-created.lead.email}}',
    )
    expect(validateWorkflowVariables(reloaded)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ severity: 'error' })]),
    )
  })

  it('treats canonical phone and email tokens as populated required fields from the same saved config', () => {
    expect(
      validateWorkflowNodeConfig('send.sms', {
        phone: '{{client.phone}}',
        message: 'Hi {{client.name}}',
      }),
    ).toMatchObject({ status: 'ready' })

    expect(
      validateWorkflowNodeConfig('send.email', {
        recipient: '{{client.email}}',
        subject: 'Follow-up',
        body: 'Hi {{client.name}}',
      }),
    ).toMatchObject({ status: 'ready' })

    expect(
      validateWorkflowNodeConfig('send.sms', {
        config: {
          phone: '{{client.phone}}',
          message: 'Hi {{client.name}}',
        },
      }),
    ).toMatchObject({ status: 'ready' })
  })

  it('restores missing-field errors when selected workflow data is removed', () => {
    const sms = validateWorkflowNodeConfig('send.sms', {
      phone: '',
      message: 'Hi',
    })
    const email = validateWorkflowNodeConfig('send.email', {
      recipient: '',
      subject: 'Follow-up',
      body: 'Hi',
    })

    expect(sms.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'phone', severity: 'error' }),
      ]),
    )
    expect(email.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'recipient', severity: 'error' }),
      ]),
    )
  })

  it('offers compatible phone and email workflow data without mixing field types', () => {
    const lead = node('lead-created', 'lead.created', 'Lead Created')
    const sms = node('send-sms', 'send.sms', 'Send SMS')
    const email = node('send-email', 'send.email', 'Send Email')
    const smsPhoneField = getWorkflowNodeDefinition(
      'send.sms',
    )?.configFields.find((field) => field.id === 'phone')
    const emailRecipientField = getWorkflowNodeDefinition(
      'send.email',
    )?.configFields.find((field) => field.id === 'recipient')
    expect(smsPhoneField).toBeTruthy()
    expect(emailRecipientField).toBeTruthy()

    const phoneOptions = getCompatibleVariablesForField({
      field: smsPhoneField!,
      variables: getAvailableVariablesForNode(sms, {
        nodes: [lead, sms],
        edges: [edge(lead.id, sms.id)],
      }),
    }).map((variable) => variable.label)
    const emailOptions = getCompatibleVariablesForField({
      field: emailRecipientField!,
      variables: getAvailableVariablesForNode(email, {
        nodes: [lead, email],
        edges: [edge(lead.id, email.id)],
      }),
    }).map((variable) => variable.label)

    expect(phoneOptions).toEqual(
      expect.arrayContaining(['Lead Phone', 'Workspace Phone']),
    )
    expect(phoneOptions.join(' ')).not.toContain('Email')
    expect(emailOptions).toEqual(
      expect.arrayContaining([
        'Lead Email',
        'Workspace Email',
        'Support Email',
        'Owner Email',
      ]),
    )
    expect(emailOptions.join(' ')).not.toContain('Phone')
  })
})
