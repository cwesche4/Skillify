import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SERVICE_BUSINESS_CUSTOMER_TAGS,
  createDefaultServiceBusinessCustomerTags,
  getClientTagOptions,
  getClientTagUsageCount,
  validateClientTagLabel,
} from '@/lib/clients/clientTagRegistry'
import type { WorkspaceClient } from '@/lib/clients/types'
import {
  DEFAULT_SERVICE_BUSINESS_JOB_TYPES,
  createDefaultServiceBusinessJobTypes,
  getServiceRequestTypeOptions,
  getServiceRequestTypeUsageCount,
  validateServiceRequestTypeLabel,
} from '@/lib/service-requests/serviceRequestTypeRegistry'
import type { WorkspaceServiceRequest } from '@/lib/service-requests/types'

const baseClient = {
  id: 'client-1',
  workspaceId: 'workspace-1',
  name: 'Avery Brooks',
  company: 'Brooks Studio',
  email: 'avery@example.com',
  phone: '555-0100',
  status: 'Active',
  pipelineStage: 'In Progress',
  lastActivity: '2026-07-01T10:00:00.000Z',
  openTasks: 0,
  value: 1000,
  nextAction: 'Follow up',
  ownerId: 'owner-1',
  health: 'Healthy',
  tags: ['VIP'],
  notes: '',
  activity: [],
  tasks: [],
  suggestedAutomations: [],
  opportunity: {
    value: 1000,
    nextAction: 'Follow up',
    probability: 50,
    expectedCloseWindow: '2 weeks',
  },
} satisfies WorkspaceClient

const baseRequest = {
  id: 'request-1',
  workspaceId: 'workspace-1',
  clientId: 'client-1',
  clientName: 'Acme',
  customerName: 'Avery',
  company: 'Acme',
  email: 'avery@example.com',
  phone: '555-0100',
  title: 'Job',
  description: 'Job details',
  notes: '',
  priority: 'Normal',
  status: 'New',
  serviceType: 'Service Call',
  assignedToOwnerId: 'owner-1',
  scheduledFor: null,
  estimatedDuration: '1 hour',
  createdAt: '2026-07-01T10:00:00.000Z',
  relatedRecords: {
    linkedClient: 'Acme',
    linkedTasks: 'No linked tasks yet',
    linkedOpportunity: '',
  },
  timeline: [],
} satisfies WorkspaceServiceRequest

describe('service business configuration registries', () => {
  it('creates service-business job type defaults and validates labels', () => {
    const types = createDefaultServiceBusinessJobTypes('workspace-1')

    expect(types.map((type) => type.label)).toEqual(
      DEFAULT_SERVICE_BUSINESS_JOB_TYPES,
    )
    expect(validateServiceRequestTypeLabel('Service Call', types)).toBe(
      'A job type with this name already exists.',
    )
    expect(validateServiceRequestTypeLabel('', types)).toBe(
      'Job type name is required.',
    )
    expect(
      validateServiceRequestTypeLabel(' Site Visit ', types),
    ).toBeUndefined()
  })

  it('merges active job types with legacy request types and counts usage', () => {
    const configuredTypes = [
      ...createDefaultServiceBusinessJobTypes('workspace-1'),
      {
        ...createDefaultServiceBusinessJobTypes('workspace-1')[0],
        id: 'archived-type',
        label: 'Archived Type',
        normalizedLabel: 'archived type',
        status: 'archived' as const,
      },
    ]
    const requests = [
      baseRequest,
      { ...baseRequest, id: 'request-2', serviceType: ' service call ' },
      { ...baseRequest, id: 'request-3', serviceType: 'Legacy Visit' },
    ]
    const options = getServiceRequestTypeOptions({
      configuredTypes,
      requests,
    })

    expect(options).toContain('Service Call')
    expect(options).toContain('Legacy Visit')
    expect(options).not.toContain('Archived Type')
    expect(getServiceRequestTypeUsageCount('Service Call', requests)).toBe(2)
  })

  it('creates service-business customer tag defaults and validates labels', () => {
    const tags = createDefaultServiceBusinessCustomerTags('workspace-1')

    expect(tags.map((tag) => tag.label)).toEqual(
      DEFAULT_SERVICE_BUSINESS_CUSTOMER_TAGS,
    )
    expect(validateClientTagLabel('vip', tags)).toBe(
      'A tag with this name already exists.',
    )
    expect(validateClientTagLabel('', tags)).toBe('Tag name is required.')
    expect(validateClientTagLabel(' Seasonal ', tags)).toBeUndefined()
  })

  it('merges active customer tags with legacy tags and counts usage', () => {
    const configuredTags = [
      ...createDefaultServiceBusinessCustomerTags('workspace-1'),
      {
        ...createDefaultServiceBusinessCustomerTags('workspace-1')[0],
        id: 'archived-tag',
        label: 'Archived Tag',
        normalizedLabel: 'archived tag',
        status: 'archived' as const,
      },
    ]
    const clients = [
      baseClient,
      { ...baseClient, id: 'client-2', tags: [' vip ', 'Recurring'] },
      { ...baseClient, id: 'client-3', tags: ['Legacy Tag'] },
    ]
    const options = getClientTagOptions({ configuredTags, clients })

    expect(options).toContain('VIP')
    expect(options).toContain('Legacy Tag')
    expect(options).not.toContain('Archived Tag')
    expect(getClientTagUsageCount('VIP', clients)).toBe(2)
  })
})
