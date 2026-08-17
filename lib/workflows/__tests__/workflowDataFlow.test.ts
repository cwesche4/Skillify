import { describe, expect, it } from 'vitest'
import type { Edge, Node } from 'reactflow'

import { analyzeWorkflowData } from '@/lib/workflows/workflowDataFlow'
import { analyzeWorkflowHealth } from '@/lib/workflows/workflowHealth'

function node(
  id: string,
  registryId: string,
  label = registryId,
  data: Record<string, unknown> = {},
  position = { x: 0, y: 0 },
): Node {
  return {
    id,
    type: registryId,
    position,
    data: {
      label,
      __registryNodeId: registryId,
      ...data,
    },
  } as Node
}

function edge(source: string, target: string, sourceHandle?: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle,
    type: 'default',
  }
}

describe('workflow data-flow analyzer', () => {
  it('tracks produced and consumed variables in a linear email workflow', () => {
    const lead = node('lead', 'lead.created', 'Lead Created')
    const email = node('email', 'send.email', 'Send Email', {
      recipient: '{{nodes.lead.lead.email}}',
      subject: 'Follow up with {{nodes.lead.lead.fullName}}',
      body: 'Hi {{nodes.lead.lead.firstName}}',
    })

    const flow = analyzeWorkflowData({
      nodes: [lead, email],
      edges: [edge('lead', 'email')],
    })

    expect(flow.graphOrder).toEqual(['lead', 'email'])
    expect(flow.producedVariables.map((variable) => variable.label)).toContain(
      'Lead Email',
    )
    expect(flow.consumedVariables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'email',
          fieldKey: 'recipient',
          variableLabel: 'Lead Email',
          status: 'valid',
        }),
        expect.objectContaining({
          nodeId: 'email',
          fieldKey: 'subject',
          status: 'valid',
        }),
      ]),
    )
    expect(flow.nodeInputs.email).toHaveLength(3)
    expect(flow.nodeOutputs.lead.map((variable) => variable.label)).toContain(
      'Lead Phone',
    )
  })

  it('filters invalid phone-to-email and accepts phone-to-sms consumption through shared metadata', () => {
    const lead = node('lead', 'lead.created', 'Lead Created')
    const sms = node('sms', 'send.sms', 'Send SMS', {
      phone: '{{nodes.lead.lead.phone}}',
      message: 'Hi {{nodes.lead.lead.fullName}}',
    })
    const email = node('email', 'send.email', 'Send Email', {
      recipient: '{{nodes.lead.lead.phone}}',
      subject: 'Follow up',
      body: 'Hi',
    })

    const flow = analyzeWorkflowData({
      nodes: [lead, sms, email],
      edges: [edge('lead', 'sms'), edge('lead', 'email')],
    })

    expect(flow.nodeInputs.sms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: 'phone',
          variableLabel: 'Lead Phone',
          status: 'valid',
        }),
      ]),
    )
    expect(flow.invalidVariables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'email',
          fieldKey: 'recipient',
          status: 'incompatible',
          variableLabel: 'Lead Phone',
        }),
      ]),
    )
  })

  it('detects deleted producers and removed upstream edges immediately', () => {
    const sms = node('sms', 'send.sms', 'Send SMS', {
      phone: '{{nodes.lead.lead.phone}}',
      message: 'Hi',
    })
    const flowWithDeletedProducer = analyzeWorkflowData({
      nodes: [sms],
      edges: [],
    })

    expect(flowWithDeletedProducer.invalidVariables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'sms',
          fieldKey: 'phone',
          status: 'deleted-producer',
        }),
      ]),
    )

    const lead = node('lead', 'lead.created', 'Lead Created')
    const flowWithDeletedEdge = analyzeWorkflowData({
      nodes: [lead, sms],
      edges: [],
    })

    expect(flowWithDeletedEdge.invalidVariables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'sms',
          fieldKey: 'phone',
          status: 'unavailable-upstream',
          sourceNodeId: 'lead',
        }),
      ]),
    )
  })

  it('models branch-specific availability and parallel branches without flattening topology', () => {
    const lead = node(
      'lead',
      'lead.created',
      'Lead Created',
      {},
      { x: 0, y: 0 },
    )
    const condition = node(
      'condition',
      'condition.branch',
      'Condition / Branch',
      {
        conditionField: '{{nodes.lead.lead.status}}',
        conditionOperator: 'equals',
        conditionValue: 'Qualified',
      },
      { x: 260, y: 0 },
    )
    const email = node(
      'email',
      'send.email',
      'Send Email',
      {
        recipient: '{{nodes.lead.lead.email}}',
        subject: 'Welcome',
        body: 'Hi',
      },
      { x: 520, y: -90 },
    )
    const task = node(
      'task',
      'task.create',
      'Create Task',
      {
        title: 'Call {{nodes.lead.lead.fullName}}',
        description: 'Qualified branch',
      },
      { x: 520, y: 90 },
    )

    const flow = analyzeWorkflowData({
      nodes: [lead, condition, email, task],
      edges: [
        edge('lead', 'condition'),
        edge('condition', 'email'),
        edge('condition', 'task'),
      ],
    })

    expect(flow.graphOrder.indexOf('lead')).toBeLessThan(
      flow.graphOrder.indexOf('condition'),
    )
    expect(flow.graphOrder.indexOf('condition')).toBeLessThan(
      flow.graphOrder.indexOf('email'),
    )
    expect(
      flow.downstreamAvailability.email.map((variable) => variable.key),
    ).toContain('nodes.lead.lead.email')
    expect(
      flow.downstreamAvailability.task.map((variable) => variable.key),
    ).toContain('nodes.lead.lead.fullName')
    expect(
      flow.consumedVariables.filter((item) => item.status !== 'valid'),
    ).toHaveLength(0)
  })

  it('keeps similar trigger outputs distinct instead of treating them as overwritten', () => {
    const leadA = node('lead-a', 'lead.created', 'Lead Created A')
    const leadB = node('lead-b', 'lead.created', 'Lead Created B')
    const task = node('task', 'task.create', 'Create Task', {
      title: 'Review {{nodes.lead-a.lead.fullName}}',
    })

    const flow = analyzeWorkflowData({
      nodes: [leadA, leadB, task],
      edges: [edge('lead-a', 'task'), edge('lead-b', 'task')],
    })

    expect(
      flow.overwrittenVariables.map((variable) => variable.path),
    ).not.toContain('lead.email')
    expect(
      flow.producedVariables.filter(
        (variable) => variable.path === 'lead.email',
      ),
    ).toHaveLength(2)
    expect(flow.consumedVariables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'task',
          fieldKey: 'title',
          status: 'valid',
        }),
      ]),
    )
  })

  it('keeps SMS Message ID and Email Message ID distinct with producer context', () => {
    const lead = node('lead', 'lead.created', 'Lead Created')
    const sms = node('sms', 'send.sms', 'Follow-up Text', {
      phone: '{{nodes.lead.lead.phone}}',
      message: 'Hi',
    })
    const email = node('email', 'send.email', 'Follow-up Email', {
      recipient: '{{nodes.lead.lead.email}}',
      subject: 'Follow up',
      body: 'Hi',
    })

    const flow = analyzeWorkflowData({
      nodes: [lead, sms, email],
      edges: [edge('lead', 'sms'), edge('sms', 'email')],
    })
    const messageIds = flow.producedVariables.filter(
      (variable) => variable.path === 'message.id',
    )

    expect(messageIds).toHaveLength(2)
    expect(messageIds.map((variable) => variable.producerContextLabel)).toEqual(
      expect.arrayContaining(['From Follow-up Text', 'From Follow-up Email']),
    )
    expect(
      flow.overwrittenVariables.map((variable) => variable.label),
    ).not.toContain('Message ID')
  })

  it('keeps two Send SMS instances node-scoped and distinct', () => {
    const lead = node('lead', 'lead.created', 'Lead Created')
    const smsA = node('sms-a', 'send.sms', 'First Text', {
      phone: '{{nodes.lead.lead.phone}}',
      message: 'One',
    })
    const smsB = node('sms-b', 'send.sms', 'Second Text', {
      phone: '{{nodes.lead.lead.phone}}',
      message: 'Two',
    })

    const flow = analyzeWorkflowData({
      nodes: [lead, smsA, smsB],
      edges: [edge('lead', 'sms-a'), edge('sms-a', 'sms-b')],
    })
    const ids = flow.producedVariables.filter(
      (variable) => variable.path === 'message.id',
    )

    expect(ids.map((variable) => variable.key)).toEqual(
      expect.arrayContaining([
        'nodes.sms-a.message.id',
        'nodes.sms-b.message.id',
      ]),
    )
    expect(flow.overwrittenVariables).toHaveLength(0)
  })

  it('detects client stage updated twice sequentially as a true overwrite', () => {
    const lead = node('lead', 'lead.created', 'Lead Created')
    const updateA = node('update-a', 'client.update', 'Update Client')
    const updateB = node('update-b', 'client.update', 'Assign Client Stage')

    const flow = analyzeWorkflowData({
      nodes: [lead, updateA, updateB],
      edges: [edge('lead', 'update-a'), edge('update-a', 'update-b')],
    })

    expect(flow.overwrittenVariables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalWritePath: 'client.stage',
          overwriteMessage: expect.stringContaining('updated again'),
        }),
      ]),
    )
  })

  it('does not treat same field updates on mutually exclusive branches as a sequential overwrite', () => {
    const lead = node('lead', 'lead.created', 'Lead Created')
    const condition = node(
      'condition',
      'condition.branch',
      'Condition / Branch',
      {
        condition: '{{nodes.lead.lead.status}} equals Qualified',
      },
    )
    const updateA = node('update-a', 'client.update', 'Qualified Stage')
    const updateB = node('update-b', 'client.update', 'Unqualified Stage')

    const flow = analyzeWorkflowData({
      nodes: [lead, condition, updateA, updateB],
      edges: [
        edge('lead', 'condition'),
        edge('condition', 'update-a', 'matched'),
        edge('condition', 'update-b', 'unmatched'),
      ],
    })

    expect(flow.overwrittenVariables).toHaveLength(0)
  })

  it('handles same field updates before and after a merge-like downstream step as sequential overwrite', () => {
    const lead = node('lead', 'lead.created', 'Lead Created')
    const updateA = node('update-a', 'client.update', 'Initial Client Stage')
    const condition = node(
      'condition',
      'condition.branch',
      'Condition / Branch',
      {
        condition: '{{nodes.lead.lead.status}} equals Qualified',
      },
    )
    const updateB = node('update-b', 'client.update', 'Final Client Stage')

    const flow = analyzeWorkflowData({
      nodes: [lead, updateA, condition, updateB],
      edges: [
        edge('lead', 'update-a'),
        edge('update-a', 'condition'),
        edge('condition', 'update-b'),
      ],
    })

    expect(
      flow.overwrittenVariables.map((variable) => variable.canonicalWritePath),
    ).toContain('client.stage')
  })

  it('reports unused and orphan variables after consumers are deleted', () => {
    const lead = node('lead', 'lead.created', 'Lead Created')
    const flow = analyzeWorkflowData({
      nodes: [lead],
      edges: [],
    })

    expect(flow.orphanVariables.length).toBeGreaterThan(0)
    expect(flow.orphanVariables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'nodes.lead.lead.email',
          unused: true,
        }),
      ]),
    )
  })

  it('separates unused business data from unused runtime and technical data', () => {
    const lead = node('lead', 'lead.created', 'Lead Created')
    const sms = node('sms', 'send.sms', 'Send SMS', {
      phone: '{{nodes.lead.lead.phone}}',
      message: 'Hi',
    })
    const webhook = node('webhook', 'webhook.placeholder', 'Webhook', {
      url: 'https://example.com',
      method: 'POST',
    })

    const flow = analyzeWorkflowData({
      nodes: [lead, sms, webhook],
      edges: [edge('lead', 'sms'), edge('sms', 'webhook')],
    })

    expect(
      flow.unusedBusinessVariables.map((variable) => variable.key),
    ).toContain('nodes.lead.lead.email')
    expect(
      flow.unusedRuntimeVariables.map((variable) => variable.key),
    ).toContain('nodes.sms.message.id')
    expect(
      flow.unusedRuntimeVariables.map((variable) => variable.key),
    ).toContain('nodes.webhook.response.body')
    expect(
      flow.unusedTechnicalVariables.map((variable) => variable.key),
    ).toContain('nodes.webhook.response.headers')
  })

  it('unused runtime variables do not reduce workflow health score through unused data suggestions', () => {
    const sms = node('sms', 'send.sms', 'Send SMS', {
      phone: '+1 555 555 5555',
      message: 'Hi',
    })
    const email = node('email', 'send.email', 'Send Email', {
      recipient: 'owner@example.com',
      subject: 'Follow up',
      body: 'Hi',
    })
    const health = analyzeWorkflowHealth({
      nodes: [sms, email],
      edges: [edge('sms', 'email')],
    })

    expect(
      health.suggestions.filter(
        (item) => item.title === 'Unused workflow data',
      ),
    ).toHaveLength(0)
  })

  it('unused business variables remain visible as suggestions', () => {
    const lead = node('lead', 'lead.created', 'Lead Created')
    const task = node('task', 'task.create', 'Create Task', {
      title: 'Follow up',
    })
    const health = analyzeWorkflowHealth({
      nodes: [lead, task],
      edges: [edge('lead', 'task')],
    })

    expect(health.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Unused workflow data',
          description: expect.stringContaining('creates'),
        }),
      ]),
    )
  })

  it('trigger context remains separate from trigger-produced outputs', () => {
    const trigger = node('task-completed', 'task.completed', 'Task Completed')
    const flow = analyzeWorkflowData({
      nodes: [trigger],
      edges: [],
    })

    expect(
      flow.nodeOutputs['task-completed'].map((variable) => variable.key),
    ).toContain('nodes.task-completed.task.id')
    expect(
      flow.nodeOutputs['task-completed'].map((variable) => variable.key),
    ).not.toContain('workspace.name')
    expect(
      flow.downstreamAvailability['task-completed'].map(
        (variable) => variable.key,
      ),
    ).toContain('workspace.name')
  })

  it('Wait / Delay outputs use explicit registry types', () => {
    for (const registryId of ['wait.delay', 'utility.wait.delay']) {
      const wait = node(registryId, registryId, 'Wait / Delay')
      const flow = analyzeWorkflowData({ nodes: [wait], edges: [] })
      expect(flow.nodeOutputs[registryId]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'wait.duration', type: 'number' }),
          expect.objectContaining({ path: 'wait.unit', type: 'string' }),
          expect.objectContaining({ path: 'wait.resumedAt', type: 'datetime' }),
          expect.objectContaining({ path: 'wait.completed', type: 'boolean' }),
        ]),
      )
      expect(
        flow.nodeOutputs[registryId].map((variable) => variable.type),
      ).not.toContain('unknown')
    }
  })

  it('tracks AI, CRM action, webhook, task, condition, and workspace data consumption through registry fields', () => {
    const lead = node('lead', 'lead.created', 'Lead Created')
    const classifier = node('ai', 'ai.llm', 'AI LLM', {
      prompt: 'Classify {{nodes.lead.lead.company}}',
      model: 'gpt-4.1-mini',
    })
    const condition = node(
      'condition',
      'condition.branch',
      'Condition / Branch',
      {
        condition: '{{nodes.ai.response.text}} equals Qualified',
      },
    )
    const webhook = node('webhook', 'webhook.placeholder', 'Webhook', {
      url: '{{workspace.website}}/lead',
      method: 'POST',
      body: '{"email":"{{nodes.lead.lead.email}}"}',
    })
    const task = node('task', 'task.create', 'Create Task', {
      title: 'Follow up {{nodes.lead.lead.fullName}}',
      description: 'Webhook status {{nodes.webhook.response.status}}',
    })

    const flow = analyzeWorkflowData({
      nodes: [lead, classifier, condition, webhook, task],
      edges: [
        edge('lead', 'ai'),
        edge('ai', 'condition'),
        edge('condition', 'webhook'),
        edge('webhook', 'task'),
      ],
    })

    expect(flow.nodeInputs.ai).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variableLabel: 'Lead Company',
          status: 'valid',
        }),
      ]),
    )
    expect(flow.nodeInputs.condition).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceNodeId: 'ai', status: 'valid' }),
      ]),
    )
    expect(flow.nodeInputs.webhook).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variableLabel: 'Workspace Website',
          status: 'valid',
        }),
        expect.objectContaining({
          variableLabel: 'Lead Email',
          status: 'valid',
        }),
      ]),
    )
    expect(flow.nodeInputs.task).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceNodeId: 'webhook', status: 'valid' }),
      ]),
    )
  })

  it('keeps lineage for produced variables and their downstream consumers', () => {
    const lead = node('lead', 'lead.created', 'Lead Created')
    const email = node('email', 'send.email', 'Send Email', {
      recipient: '{{nodes.lead.lead.email}}',
      subject: 'Follow up',
      body: 'Hi',
    })
    const task = node('task', 'task.create', 'Create Task', {
      title: 'Review {{nodes.email.message.id}}',
    })

    const flow = analyzeWorkflowData({
      nodes: [lead, email, task],
      edges: [edge('lead', 'email'), edge('email', 'task')],
    })

    expect(flow.variableLineage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variableKey: 'nodes.lead.lead.email',
          originNodeId: 'lead',
          consumerNodeIds: ['email'],
          lastConsumerNodeId: 'email',
        }),
        expect.objectContaining({
          variableKey: 'nodes.email.message.id',
          originNodeId: 'email',
          consumerNodeIds: ['task'],
          lastConsumerNodeId: 'task',
        }),
      ]),
    )
    expect(flow.nodeInputs.task).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'task',
          fieldKey: 'title',
          sourceNodeId: 'email',
          variableLabel: 'Message ID',
        }),
      ]),
    )
    expect(
      flow.nodeOutputs.email.find((variable) => variable.path === 'message.id')
        ?.consumers,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'task',
          fieldLabel: 'Title',
        }),
      ]),
    )
  })

  it('deleted producer still creates broken variable flow', () => {
    const task = node('task', 'task.create', 'Create Task', {
      title: 'Review {{nodes.deleted.task.title}}',
    })
    const flow = analyzeWorkflowData({ nodes: [task], edges: [] })

    expect(flow.invalidVariables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'task',
          fieldKey: 'title',
          status: 'deleted-producer',
        }),
      ]),
    )
  })

  it('registry-backed future-style utility nodes inherit classification without node-name checks', () => {
    const lead = node('lead', 'lead.created', 'Lead Created')
    const formatter = node(
      'formatter',
      'utility.text.formatter',
      'Text Formatter',
      {
        inputText: '{{nodes.lead.lead.company}}',
        operation: 'Title Case',
      },
    )

    const flow = analyzeWorkflowData({
      nodes: [lead, formatter],
      edges: [edge('lead', 'formatter')],
    })

    expect(flow.nodeInputs.formatter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variableLabel: 'Lead Company',
          status: 'valid',
        }),
      ]),
    )
    expect(flow.nodeOutputs.formatter[0]).toEqual(
      expect.objectContaining({
        dataRole: 'business',
        warnWhenUnused: true,
      }),
    )
  })
})
