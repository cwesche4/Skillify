import type {
  NodeConfigField,
  WorkflowNodeDefinition,
  WorkflowPort,
  WorkflowValueType,
} from '@/lib/workflows/types'

export const SCHEDULING_WORKFLOW_CATEGORY = 'Scheduling' as const

type SchedulingWorkflowDefinitionInput = Omit<
  WorkflowNodeDefinition,
  'configurationSchema' | 'validation' | 'execution'
>

export type SchedulingWorkflowTriggerKey =
  | 'event.created'
  | 'event.updated'
  | 'event.rescheduled'
  | 'event.assigned'
  | 'event.reassigned'
  | 'event.completed'
  | 'event.canceled'
  | 'event.deleted'
  | 'event.missed'
  | 'recurrence.series_created'
  | 'recurrence.series_updated'
  | 'recurrence.series_split'
  | 'recurrence.series_paused'
  | 'recurrence.series_resumed'
  | 'recurrence.series_canceled'
  | 'time_off.created'
  | 'time_off.updated'
  | 'time_off.approved'
  | 'availability_exception.created'
  | 'availability_exception.updated'
  | 'calendar.connected'
  | 'calendar.disconnected'
  | 'calendar.sync_completed'
  | 'calendar.sync_failed'
  | 'provider.conflict_detected'
  | 'provider.conflict_resolved'
  | 'external_availability.conflict'
  | 'reminder.sent'
  | 'reminder.failed'
  | 'notification.delivered'
  | 'notification.failed'
  | 'scheduling_conflict.created'
  | 'scheduling_conflict.resolved'
  | 'worker.failure'
  | 'worker.recovery'

export type SchedulingWorkflowActionKey =
  | 'create_event'
  | 'update_event'
  | 'delete_event'
  | 'cancel_event'
  | 'reschedule_event'
  | 'assign_member'
  | 'assign_team'
  | 'complete_event'
  | 'pause_series'
  | 'resume_series'
  | 'cancel_series'
  | 'create_time_off'
  | 'create_availability_exception'
  | 'connect_calendar'
  | 'disconnect_calendar'
  | 'sync_calendar'
  | 'repair_calendar_mapping'
  | 'retry_provider_sync'
  | 'send_scheduling_notification'
  | 'send_reminder'
  | 'acknowledge_external_availability_conflict'
  | 'override_external_availability_conflict'

export type SchedulingWorkflowConditionKey =
  | 'has_scheduling_conflict'
  | 'has_external_availability_conflict'
  | 'has_time_off'
  | 'has_availability_exception'
  | 'calendar_connected'
  | 'calendar_healthy'
  | 'provider_healthy'
  | 'reminder_enabled'
  | 'recurring_event'
  | 'one_time_event'
  | 'member_available'
  | 'team_available'
  | 'conflict_blocking'
  | 'conflict_suggestion'
  | 'provider_sync_enabled'
  | 'personal_calendar_approved'
  | 'workspace_calendar_approved'

export type SchedulingWorkflowTriggerDefinition = {
  key: SchedulingWorkflowTriggerKey
  nodeId: string
  label: string
  description: string
  outboxTopics: string[]
  eventType?: string
  payloadMatchers?: Record<string, string>
  keywords: string[]
}

export type SchedulingWorkflowActionDefinition = {
  key: SchedulingWorkflowActionKey
  nodeId: string
  label: string
  description: string
  service:
    | 'schedulingService'
    | 'calendarProviderService'
    | 'notificationService'
    | 'externalAvailabilityService'
  operation: string
  requiredFields: string[]
  keywords: string[]
}

export type SchedulingWorkflowConditionDefinition = {
  key: SchedulingWorkflowConditionKey
  nodeId: string
  label: string
  description: string
  service:
    | 'schedulingRepository'
    | 'externalAvailabilityService'
    | 'calendarProviderService'
  operation: string
  requiredFields: string[]
  keywords: string[]
}

export type SchedulingWorkflowTriggerPayload = {
  workspace: Record<string, unknown>
  actor: Record<string, unknown> | null
  event: Record<string, unknown> | null
  occurrence: Record<string, unknown> | null
  series: Record<string, unknown> | null
  timestamps: Record<string, unknown>
  providerMetadata: Record<string, unknown> | null
  linkedRecord: Record<string, unknown> | null
  assignment: Record<string, unknown> | null
  status: Record<string, unknown> | null
  recurrence: Record<string, unknown> | null
  conflict: Record<string, unknown> | null
  providerMapping: Record<string, unknown> | null
  availability: Record<string, unknown> | null
  externalAvailability: Record<string, unknown> | null
  notificationMetadata: Record<string, unknown> | null
  raw: Record<string, unknown>
}

export type SchedulingWorkflowTemplate = {
  id: string
  title: string
  category: typeof SCHEDULING_WORKFLOW_CATEGORY
  description: string
  triggerNodeId: string
  actionNodeIds: string[]
  keywords: string[]
}

const eventStatuses = [
  'scheduled',
  'confirmed',
  'inProgress',
  'completed',
  'canceled',
  'missed',
]
const providers = ['google', 'microsoft', 'apple', 'caldav']
const conflictPolicies = ['warning', 'blocking']

function field(
  id: string,
  label: string,
  type: NodeConfigField['type'],
  options: Partial<NodeConfigField> = {},
): NodeConfigField {
  return {
    id,
    label,
    type,
    group: options.group ?? 'Scheduling',
    ...options,
  }
}

function selectField(
  id: string,
  label: string,
  values: string[],
  options: Partial<NodeConfigField> = {},
): NodeConfigField {
  return field(id, label, 'select', {
    options: values.map((value) => ({ label: value, value })),
    ...options,
  })
}

function multiField(
  id: string,
  label: string,
  values: string[],
  options: Partial<NodeConfigField> = {},
): NodeConfigField {
  return field(id, label, 'multi-select', {
    options: values.map((value) => ({ label: value, value })),
    ...options,
  })
}

function output(
  id: string,
  label: string,
  dataType: WorkflowValueType,
  sampleValue: unknown,
  options: Partial<WorkflowPort> = {},
): WorkflowPort {
  return {
    id,
    label,
    dataType,
    sampleValue,
    namespace: id.split('.')[0],
    ...options,
  }
}

export const schedulingTriggerFilters: NodeConfigField[] = [
  multiField('providers', 'Provider', providers, {
    helpText: 'Limit the trigger to selected calendar providers.',
    semanticRole: 'enum',
    optionSource: 'scheduling.providers',
    repairGroup: 'schedulingTriggerFilters',
  }),
  multiField('statuses', 'Status', eventStatuses, {
    helpText: 'Limit event lifecycle triggers to selected statuses.',
    semanticRole: 'status',
    optionSource: 'scheduling.eventStatuses',
    repairGroup: 'schedulingTriggerFilters',
  }),
  field('eventType', 'Event type', 'text', {
    placeholder: 'appointment, internalMeeting, scheduledJob',
    helpText: 'Optional resolved Scheduling event type key.',
    optionSource: 'scheduling.eventTypes',
    semanticRole: 'enum',
    repairGroup: 'schedulingTriggerFilters',
  }),
  field('calendarId', 'Calendar', 'text', {
    placeholder: '{{calendar.id}}',
    helpText: 'Optional connected calendar ID.',
    optionSource: 'scheduling.calendars',
    semanticRole: 'identifier',
    repairGroup: 'schedulingTriggerFilters',
  }),
  field('workspaceLocationId', 'Workspace location', 'text', {
    placeholder: '{{location.id}}',
    optionSource: 'workspace.locations',
    semanticRole: 'identifier',
    workspaceOptionCategory: 'locations',
    storedValue: 'id',
    repairGroup: 'schedulingTriggerFilters',
  }),
  field('teamId', 'Team', 'text', {
    placeholder: '{{team.id}}',
    optionSource: 'workspace.teams',
    semanticRole: 'team',
    semanticType: 'owner',
    workspaceOptionCategory: 'teams',
    storedValue: 'id',
    repairGroup: 'schedulingTriggerFilters',
  }),
  field('memberId', 'Member', 'text', {
    placeholder: '{{member.id}}',
    optionSource: 'workspace.members',
    semanticRole: 'assignee',
    workspaceOptionCategory: 'members',
    storedValue: 'id',
    repairGroup: 'schedulingTriggerFilters',
  }),
  selectField(
    'purpose',
    'Purpose',
    ['PERSONAL', 'INDIVIDUAL_WORK', 'WORKSPACE_SHARED', 'RESOURCE', 'UNKNOWN'],
    {
      helpText: 'Optional calendar purpose classification filter.',
      optionSource: 'scheduling.calendarPurposes',
      repairGroup: 'schedulingTriggerFilters',
    },
  ),
  selectField(
    'approvalState',
    'Approval state',
    ['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW'],
    {
      optionSource: 'scheduling.approvalStates',
      repairGroup: 'schedulingTriggerFilters',
    },
  ),
  selectField('recurrence', 'Recurrence', ['any', 'recurring', 'oneTime'], {
    defaultValue: 'any',
    helpText: 'Limit to recurring or one-time Scheduling records.',
    repairGroup: 'schedulingTriggerFilters',
  }),
  selectField(
    'conflictType',
    'Conflict type',
    ['any', 'provider', 'externalAvailability', 'scheduling'],
    {
      defaultValue: 'any',
      repairGroup: 'schedulingTriggerFilters',
    },
  ),
  selectField(
    'timeOffCategory',
    'Time off category',
    ['vacation', 'sick', 'personal', 'appointment', 'unavailable', 'other'],
    {
      optionSource: 'scheduling.timeOffCategories',
      repairGroup: 'schedulingTriggerFilters',
    },
  ),
  selectField(
    'availabilityCategory',
    'Availability category',
    ['workingHours', 'timeOff', 'availabilityException', 'blockedTime'],
    {
      optionSource: 'scheduling.availabilityKinds',
      repairGroup: 'schedulingTriggerFilters',
    },
  ),
  selectField(
    'reminderType',
    'Reminder type',
    ['default', 'custom', 'workspaceDefault'],
    {
      optionSource: 'scheduling.reminderTypes',
      repairGroup: 'schedulingTriggerFilters',
    },
  ),
  selectField(
    'notificationChannel',
    'Notification channel',
    ['inApp', 'email', 'sms', 'push'],
    {
      optionSource: 'scheduling.notificationChannels',
      repairGroup: 'schedulingTriggerFilters',
    },
  ),
]

export const schedulingTriggerOutputs: WorkflowPort[] = [
  output('workspace.id', 'Workspace ID', 'string', 'workspace_123', {
    dataRole: 'runtime',
    warnWhenUnused: false,
  }),
  output(
    'workspace.timezone',
    'Workspace Timezone',
    'string',
    'America/New_York',
  ),
  output('actor.userId', 'Actor User ID', 'string', 'user_123', {
    nullable: true,
  }),
  output(
    'actor.workspaceMemberId',
    'Actor Workspace Member ID',
    'string',
    'member_123',
    { nullable: true },
  ),
  output('event.id', 'Event ID', 'string', 'evt_123', {
    writePath: 'event.id',
  }),
  output('event.title', 'Event Title', 'string', 'Proposal Review', {
    writePath: 'event.title',
  }),
  output('event.type', 'Event Type', 'string', 'appointment', {
    writePath: 'event.type',
  }),
  output('event.status', 'Event Status', 'string', 'scheduled', {
    writePath: 'event.status',
  }),
  output(
    'event.startsAt',
    'Start Time',
    'datetime',
    '2026-07-30T14:00:00.000Z',
    { writePath: 'event.startsAt' },
  ),
  output('event.endsAt', 'End Time', 'datetime', '2026-07-30T15:00:00.000Z', {
    writePath: 'event.endsAt',
  }),
  output('event.timezone', 'Timezone', 'string', 'America/New_York', {
    writePath: 'event.timezone',
  }),
  output('event.durationMinutes', 'Duration', 'duration', 60),
  output('occurrence.id', 'Occurrence ID', 'string', 'occ_123', {
    nullable: true,
  }),
  output(
    'occurrence.startsAt',
    'Occurrence Start Time',
    'datetime',
    '2026-07-30T14:00:00.000Z',
    { nullable: true },
  ),
  output(
    'occurrence.endsAt',
    'Occurrence End Time',
    'datetime',
    '2026-07-30T15:00:00.000Z',
    { nullable: true },
  ),
  output('series.id', 'Series ID', 'string', 'series_123', { nullable: true }),
  output('series.status', 'Series Status', 'string', 'active', {
    nullable: true,
  }),
  output('assignment.memberId', 'Assigned Member', 'string', 'member_123', {
    nullable: true,
  }),
  output('assignment.teamId', 'Assigned Team', 'string', 'team_123', {
    nullable: true,
  }),
  output('linkedRecord.type', 'Linked Record Type', 'string', 'client', {
    nullable: true,
  }),
  output('linkedRecord.id', 'Linked Record ID', 'string', 'client_123', {
    nullable: true,
  }),
  output('provider.name', 'Provider', 'string', 'google', { nullable: true }),
  output('calendar.id', 'Calendar', 'string', 'calendar_123', {
    nullable: true,
  }),
  output('conflict.id', 'Conflict ID', 'string', 'conflict_123', {
    nullable: true,
  }),
  output('conflict.type', 'Conflict Type', 'string', 'externalAvailability', {
    nullable: true,
  }),
  output('availability.id', 'Availability ID', 'string', 'availability_123', {
    nullable: true,
  }),
  output('timeOff.id', 'Time Off ID', 'string', 'timeoff_123', {
    nullable: true,
  }),
  output(
    'availabilityException.id',
    'Availability Exception ID',
    'string',
    'exception_123',
    { nullable: true },
  ),
  output(
    'providerConnection.id',
    'Provider Connection',
    'string',
    'connection_123',
    { nullable: true },
  ),
  output(
    'externalAvailability.signalId',
    'External Availability Signal',
    'string',
    'signal_123',
    { nullable: true },
  ),
  output('calendar.purpose', 'Purpose', 'string', 'WORKSPACE_SHARED', {
    nullable: true,
  }),
  output('calendar.approvalStatus', 'Approval Status', 'string', 'APPROVED', {
    nullable: true,
  }),
  output('calendar.visibilityMode', 'Visibility Mode', 'string', 'BUSY_ONLY', {
    nullable: true,
  }),
  output('notification.id', 'Notification ID', 'string', 'notification_123', {
    nullable: true,
  }),
  output('notification.channel', 'Notification Channel', 'string', 'email', {
    nullable: true,
  }),
  output(
    'trigger.topic',
    'Scheduling Topic',
    'string',
    'scheduling.event.created',
    { dataRole: 'technical', warnWhenUnused: false },
  ),
  output(
    'trigger.occurredAt',
    'Occurred At',
    'datetime',
    '2026-07-30T14:00:00.000Z',
    { dataRole: 'runtime', warnWhenUnused: false },
  ),
]

const actionOutputs: WorkflowPort[] = [
  output('scheduling.action', 'Scheduling Action', 'string', 'create_event', {
    dataRole: 'runtime',
    warnWhenUnused: false,
  }),
  output(
    'scheduling.status',
    'Scheduling Action Status',
    'string',
    'completed',
    { dataRole: 'runtime', warnWhenUnused: false },
  ),
  output('event.id', 'Event ID', 'string', 'evt_123', {
    nullable: true,
    writePath: 'event.id',
  }),
  output('series.id', 'Series ID', 'string', 'series_123', {
    nullable: true,
    writePath: 'series.id',
  }),
  output('availability.id', 'Availability ID', 'string', 'availability_123', {
    nullable: true,
    writePath: 'availability.id',
  }),
  output(
    'calendar.connectionId',
    'Calendar Connection ID',
    'string',
    'connection_123',
    { nullable: true },
  ),
  output('conflict.id', 'Conflict ID', 'string', 'conflict_123', {
    nullable: true,
  }),
  output('notification.id', 'Notification ID', 'string', 'notification_123', {
    nullable: true,
  }),
  output('scheduling.preview', 'Preview Mode', 'boolean', true, {
    dataRole: 'technical',
    warnWhenUnused: false,
  }),
]

const conditionOutputs: WorkflowPort[] = [
  output('condition.matches', 'Matches', 'boolean', true),
  output('condition.reason', 'Reason', 'string', 'Condition matched.'),
  output(
    'condition.checkedAt',
    'Checked At',
    'datetime',
    '2026-07-30T14:00:00.000Z',
    { dataRole: 'runtime', warnWhenUnused: false },
  ),
]

function trigger(
  key: SchedulingWorkflowTriggerKey,
  label: string,
  outboxTopics: string[],
  description: string,
  keywords: string[] = [],
  payloadMatchers?: Record<string, string>,
): SchedulingWorkflowTriggerDefinition {
  return {
    key,
    nodeId: `scheduling.trigger.${key.replace(/_/g, '-').replace(/\./g, '_')}`,
    label,
    description,
    outboxTopics,
    payloadMatchers,
    keywords,
  }
}

export const schedulingWorkflowTriggers: SchedulingWorkflowTriggerDefinition[] =
  [
    trigger(
      'event.created',
      'Event Created',
      ['scheduling.event.created'],
      'Start when a Scheduling event is created.',
      ['calendar', 'event', 'appointment', 'meeting', 'job'],
    ),
    trigger(
      'event.updated',
      'Event Updated',
      ['scheduling.event.updated'],
      'Start when a Scheduling event changes.',
      ['calendar', 'event'],
    ),
    trigger(
      'event.rescheduled',
      'Event Rescheduled',
      ['scheduling.event.updated'],
      'Start when an event start or end time changes.',
      ['calendar', 'reschedule'],
      { changeType: 'rescheduled' },
    ),
    trigger(
      'event.assigned',
      'Event Assigned',
      ['scheduling.event.updated', 'scheduling.event.created'],
      'Start when an event receives an assignment.',
      ['assignment', 'member', 'team'],
      { changeType: 'assigned' },
    ),
    trigger(
      'event.reassigned',
      'Event Reassigned',
      ['scheduling.event.updated'],
      'Start when an event assignment changes.',
      ['assignment', 'member', 'team'],
      { changeType: 'reassigned' },
    ),
    trigger(
      'event.completed',
      'Event Completed',
      ['scheduling.event.completed', 'scheduling.event.status_changed'],
      'Start when an event is completed.',
      ['completed'],
      { status: 'completed' },
    ),
    trigger(
      'event.canceled',
      'Event Canceled',
      ['scheduling.event.canceled', 'scheduling.event.status_changed'],
      'Start when an event is canceled.',
      ['canceled', 'cancelled'],
      { status: 'canceled' },
    ),
    trigger(
      'event.deleted',
      'Event Deleted',
      ['scheduling.event.deleted'],
      'Start when an event is deleted.',
      ['deleted'],
    ),
    trigger(
      'event.missed',
      'Event Missed',
      ['scheduling.event.status_changed'],
      'Start when an event is marked missed.',
      ['missed'],
      { status: 'missed' },
    ),
    trigger(
      'recurrence.series_created',
      'Recurring Series Created',
      ['scheduling.recurrence_series.created'],
      'Start when a recurring Scheduling series is created.',
      ['recurrence', 'recurring'],
    ),
    trigger(
      'recurrence.series_updated',
      'Recurring Series Updated',
      ['scheduling.recurrence.series_updated'],
      'Start when a recurring Scheduling series changes.',
      ['recurrence', 'recurring'],
    ),
    trigger(
      'recurrence.series_split',
      'Recurring Series Split',
      ['scheduling.recurrence.series_split'],
      'Start when a recurring series is split.',
      ['recurrence', 'split'],
    ),
    trigger(
      'recurrence.series_paused',
      'Recurring Series Paused',
      ['scheduling.recurrence_series.paused'],
      'Start when a recurring series is paused.',
      ['recurrence', 'paused'],
    ),
    trigger(
      'recurrence.series_resumed',
      'Recurring Series Resumed',
      ['scheduling.recurrence_series.resumed'],
      'Start when a recurring series is resumed.',
      ['recurrence', 'resumed'],
    ),
    trigger(
      'recurrence.series_canceled',
      'Recurring Series Canceled',
      [
        'scheduling.recurrence_series.canceled',
        'scheduling.recurrence.series_deleted',
      ],
      'Start when a recurring series is canceled.',
      ['recurrence', 'canceled'],
    ),
    trigger(
      'time_off.created',
      'Time Off Created',
      ['scheduling.availability.changed', 'scheduling.time_off.created'],
      'Start when time off is created.',
      ['time off', 'availability'],
      { kind: 'timeOff', action: 'created' },
    ),
    trigger(
      'time_off.updated',
      'Time Off Updated',
      ['scheduling.availability.changed', 'scheduling.time_off.updated'],
      'Start when time off changes.',
      ['time off', 'availability'],
      { kind: 'timeOff', action: 'updated' },
    ),
    trigger(
      'time_off.approved',
      'Time Off Approved',
      ['scheduling.time_off.approved'],
      'Start when time off is approved.',
      ['time off', 'approved'],
    ),
    trigger(
      'availability_exception.created',
      'Availability Exception Created',
      [
        'scheduling.availability.changed',
        'scheduling.availability_exception.created',
      ],
      'Start when an availability exception is created.',
      ['availability', 'exception'],
      { kind: 'availabilityException', action: 'created' },
    ),
    trigger(
      'availability_exception.updated',
      'Availability Exception Updated',
      [
        'scheduling.availability.changed',
        'scheduling.availability_exception.updated',
      ],
      'Start when an availability exception changes.',
      ['availability', 'exception'],
      { kind: 'availabilityException', action: 'updated' },
    ),
    trigger(
      'calendar.connected',
      'Calendar Connected',
      [
        'scheduling.calendar.connected',
        'scheduling.calendar_connection.classification_confirmed',
      ],
      'Start when a calendar connection becomes usable.',
      ['calendar', 'provider', 'google', 'outlook', 'apple', 'caldav'],
    ),
    trigger(
      'calendar.disconnected',
      'Calendar Disconnected',
      [
        'scheduling.calendar.disconnected',
        'scheduling.calendar_connection.disabled',
      ],
      'Start when a calendar is disconnected or disabled.',
      ['calendar', 'provider'],
    ),
    trigger(
      'calendar.sync_completed',
      'Calendar Sync Completed',
      ['scheduling.calendar.sync_completed'],
      'Start when provider sync completes.',
      ['sync', 'provider'],
    ),
    trigger(
      'calendar.sync_failed',
      'Calendar Sync Failed',
      ['scheduling.calendar.sync_failed'],
      'Start when provider sync fails.',
      ['sync', 'provider', 'failed'],
    ),
    trigger(
      'provider.conflict_detected',
      'Provider Conflict Detected',
      ['scheduling.provider.conflict_detected'],
      'Start when a provider mapping conflict is detected.',
      ['conflict', 'mapping', 'provider'],
    ),
    trigger(
      'provider.conflict_resolved',
      'Provider Conflict Resolved',
      ['scheduling.provider.conflict_resolved'],
      'Start when a provider conflict is resolved.',
      ['conflict', 'resolved'],
    ),
    trigger(
      'external_availability.conflict',
      'External Availability Conflict',
      [
        'scheduling.external_availability.conflict_detected',
        'scheduling.external_availability.conflict_acknowledged',
        'scheduling.external_availability.conflict_overridden',
      ],
      'Start when external availability affects an event.',
      ['external availability', 'conflict'],
    ),
    trigger(
      'reminder.sent',
      'Reminder Sent',
      ['scheduling.reminder.sent'],
      'Start when a Scheduling reminder is sent.',
      ['reminder'],
    ),
    trigger(
      'reminder.failed',
      'Reminder Failed',
      ['scheduling.reminder.failed'],
      'Start when a Scheduling reminder fails.',
      ['reminder', 'failed'],
    ),
    trigger(
      'notification.delivered',
      'Notification Delivered',
      ['scheduling.notification.delivered'],
      'Start when a Scheduling notification is delivered.',
      ['notification', 'delivered'],
    ),
    trigger(
      'notification.failed',
      'Notification Failed',
      ['scheduling.notification.failed'],
      'Start when a Scheduling notification delivery fails.',
      ['notification', 'failed'],
    ),
    trigger(
      'scheduling_conflict.created',
      'Scheduling Conflict Created',
      ['scheduling.conflict.created'],
      'Start when the native Scheduling conflict engine creates a conflict.',
      ['conflict'],
    ),
    trigger(
      'scheduling_conflict.resolved',
      'Scheduling Conflict Resolved',
      ['scheduling.conflict.resolved'],
      'Start when a native Scheduling conflict is resolved.',
      ['conflict', 'resolved'],
    ),
    trigger(
      'worker.failure',
      'Worker Failure',
      ['scheduling.worker.failure'],
      'Start when a Scheduling worker reports a failure.',
      ['worker', 'failed'],
    ),
    trigger(
      'worker.recovery',
      'Worker Recovery',
      ['scheduling.worker.recovery'],
      'Start when a Scheduling worker recovery completes.',
      ['worker', 'recovery'],
    ),
  ]

function action(
  key: SchedulingWorkflowActionKey,
  label: string,
  service: SchedulingWorkflowActionDefinition['service'],
  operation: string,
  requiredFields: string[],
  description: string,
  keywords: string[] = [],
): SchedulingWorkflowActionDefinition {
  return {
    key,
    nodeId: `scheduling.action.${key}`,
    label,
    description,
    service,
    operation,
    requiredFields,
    keywords,
  }
}

export const schedulingWorkflowActions: SchedulingWorkflowActionDefinition[] = [
  action(
    'create_event',
    'Create Event',
    'schedulingService',
    'createSchedulingEvent',
    ['title', 'eventType', 'startsAt', 'endsAt', 'timezone'],
    'Create an event through the Scheduling service.',
    ['calendar', 'event', 'appointment'],
  ),
  action(
    'update_event',
    'Update Event',
    'schedulingService',
    'updateSchedulingEvent',
    ['eventId'],
    'Update an event through the Scheduling service.',
    ['calendar', 'event'],
  ),
  action(
    'delete_event',
    'Delete Event',
    'schedulingService',
    'deleteSchedulingEvent',
    ['eventId'],
    'Delete an event through the Scheduling service.',
    ['calendar', 'event'],
  ),
  action(
    'cancel_event',
    'Cancel Event',
    'schedulingService',
    'changeSchedulingEventStatus:canceled',
    ['eventId'],
    'Cancel an event through the Scheduling lifecycle.',
    ['calendar', 'cancel'],
  ),
  action(
    'reschedule_event',
    'Reschedule Event',
    'schedulingService',
    'updateSchedulingEvent:reschedule',
    ['eventId', 'startsAt', 'endsAt'],
    'Move an event to a new time through the Scheduling service.',
    ['calendar', 'reschedule'],
  ),
  action(
    'assign_member',
    'Assign Member',
    'schedulingService',
    'updateSchedulingEvent:assignMember',
    ['eventId', 'memberId'],
    'Assign a workspace member to an event through Scheduling.',
    ['assignment', 'member'],
  ),
  action(
    'assign_team',
    'Assign Team',
    'schedulingService',
    'updateSchedulingEvent:assignTeam',
    ['eventId', 'teamId'],
    'Assign a team to an event when Scheduling team assignment support is available.',
    ['assignment', 'team'],
  ),
  action(
    'complete_event',
    'Complete Event',
    'schedulingService',
    'changeSchedulingEventStatus:completed',
    ['eventId'],
    'Complete an event through the Scheduling lifecycle.',
    ['completed'],
  ),
  action(
    'pause_series',
    'Pause Series',
    'schedulingService',
    'changeSchedulingRecurrenceSeriesStatus:pause',
    ['seriesId'],
    'Pause a recurring series.',
    ['recurrence', 'pause'],
  ),
  action(
    'resume_series',
    'Resume Series',
    'schedulingService',
    'changeSchedulingRecurrenceSeriesStatus:resume',
    ['seriesId'],
    'Resume a paused recurring series.',
    ['recurrence', 'resume'],
  ),
  action(
    'cancel_series',
    'Cancel Series',
    'schedulingService',
    'changeSchedulingRecurrenceSeriesStatus:cancel',
    ['seriesId'],
    'Cancel a recurring series.',
    ['recurrence', 'cancel'],
  ),
  action(
    'create_time_off',
    'Create Time Off',
    'schedulingService',
    'createSchedulingAvailabilityRecord:timeOff',
    ['memberId', 'startsAt', 'endsAt'],
    'Create a Time Off availability record.',
    ['time off', 'availability'],
  ),
  action(
    'create_availability_exception',
    'Create Availability Exception',
    'schedulingService',
    'createSchedulingAvailabilityRecord:availabilityException',
    ['date', 'exceptionType'],
    'Create an availability exception.',
    ['availability', 'exception'],
  ),
  action(
    'connect_calendar',
    'Connect Calendar',
    'calendarProviderService',
    'connectCalendar',
    ['provider'],
    'Begin a governed provider calendar connection.',
    ['calendar', 'provider', 'google', 'outlook', 'apple', 'caldav'],
  ),
  action(
    'disconnect_calendar',
    'Disconnect Calendar',
    'calendarProviderService',
    'disconnectCalendar',
    ['provider', 'connectionId'],
    'Disconnect a governed provider calendar connection.',
    ['calendar', 'provider'],
  ),
  action(
    'sync_calendar',
    'Sync Calendar',
    'calendarProviderService',
    'syncCalendar',
    ['provider', 'connectionId'],
    'Run provider calendar sync through the Scheduling sync service.',
    ['sync', 'provider'],
  ),
  action(
    'repair_calendar_mapping',
    'Repair Calendar Mapping',
    'calendarProviderService',
    'repairCalendarMapping',
    ['provider'],
    'Inspect or repair provider mapping integrity.',
    ['repair', 'mapping'],
  ),
  action(
    'retry_provider_sync',
    'Retry Provider Sync',
    'calendarProviderService',
    'retryProviderSync',
    ['provider', 'connectionId'],
    'Retry a failed provider sync.',
    ['sync', 'retry'],
  ),
  action(
    'send_scheduling_notification',
    'Send Scheduling Notification',
    'notificationService',
    'processSchedulingNotificationOutbox',
    ['notificationId'],
    'Queue or process a Scheduling notification.',
    ['notification'],
  ),
  action(
    'send_reminder',
    'Send Reminder',
    'notificationService',
    'processDueSchedulingReminders',
    ['eventId'],
    'Queue or process a Scheduling reminder.',
    ['reminder'],
  ),
  action(
    'acknowledge_external_availability_conflict',
    'Acknowledge External Availability Conflict',
    'externalAvailabilityService',
    'acknowledgeExternalAvailabilityConflict',
    ['conflictId'],
    'Acknowledge a nonblocking external availability conflict.',
    ['external availability', 'conflict'],
  ),
  action(
    'override_external_availability_conflict',
    'Override External Availability Conflict',
    'externalAvailabilityService',
    'overrideExternalAvailabilityConflict',
    ['conflictId', 'reason'],
    'Override a blocking external availability conflict with an audit reason.',
    ['external availability', 'conflict', 'override'],
  ),
]

function condition(
  key: SchedulingWorkflowConditionKey,
  label: string,
  service: SchedulingWorkflowConditionDefinition['service'],
  operation: string,
  requiredFields: string[],
  description: string,
  keywords: string[] = [],
): SchedulingWorkflowConditionDefinition {
  return {
    key,
    nodeId: `scheduling.condition.${key}`,
    label,
    description,
    service,
    operation,
    requiredFields,
    keywords,
  }
}

export const schedulingWorkflowConditions: SchedulingWorkflowConditionDefinition[] =
  [
    condition(
      'has_scheduling_conflict',
      'Has Scheduling Conflict',
      'schedulingRepository',
      'hasSchedulingConflict',
      ['eventId'],
      'Check whether an event has a native Scheduling conflict.',
      ['conflict'],
    ),
    condition(
      'has_external_availability_conflict',
      'Has External Availability Conflict',
      'externalAvailabilityService',
      'hasExternalAvailabilityConflict',
      ['eventId'],
      'Check whether an event has external availability conflicts.',
      ['external availability', 'conflict'],
    ),
    condition(
      'has_time_off',
      'Has Time Off',
      'schedulingRepository',
      'hasTimeOff',
      ['memberId'],
      'Check whether a member has time off in the configured window.',
      ['time off'],
    ),
    condition(
      'has_availability_exception',
      'Has Availability Exception',
      'schedulingRepository',
      'hasAvailabilityException',
      ['date'],
      'Check whether an availability exception applies.',
      ['availability', 'exception'],
    ),
    condition(
      'calendar_connected',
      'Calendar Connected',
      'calendarProviderService',
      'calendarConnected',
      ['provider'],
      'Check whether a provider calendar is connected.',
      ['calendar', 'provider'],
    ),
    condition(
      'calendar_healthy',
      'Calendar Healthy',
      'calendarProviderService',
      'calendarHealthy',
      ['connectionId'],
      'Check whether a calendar connection is healthy.',
      ['calendar', 'health'],
    ),
    condition(
      'provider_healthy',
      'Provider Healthy',
      'calendarProviderService',
      'providerHealthy',
      ['provider'],
      'Check whether a provider is healthy.',
      ['provider', 'health'],
    ),
    condition(
      'reminder_enabled',
      'Reminder Enabled',
      'schedulingRepository',
      'reminderEnabled',
      ['eventId'],
      'Check whether reminders are enabled for an event.',
      ['reminder'],
    ),
    condition(
      'recurring_event',
      'Recurring Event',
      'schedulingRepository',
      'recurringEvent',
      ['eventId'],
      'Check whether an event belongs to a recurring series.',
      ['recurrence'],
    ),
    condition(
      'one_time_event',
      'One-Time Event',
      'schedulingRepository',
      'oneTimeEvent',
      ['eventId'],
      'Check whether an event is not recurring.',
      ['one time'],
    ),
    condition(
      'member_available',
      'Member Available',
      'externalAvailabilityService',
      'memberAvailable',
      ['memberId', 'startsAt', 'endsAt'],
      'Check whether a member is available for a time window.',
      ['member', 'availability'],
    ),
    condition(
      'team_available',
      'Team Available',
      'externalAvailabilityService',
      'teamAvailable',
      ['teamId', 'startsAt', 'endsAt'],
      'Check whether a team is available for a time window.',
      ['team', 'availability'],
    ),
    condition(
      'conflict_blocking',
      'Conflict Blocking',
      'externalAvailabilityService',
      'conflictBlocking',
      ['conflictId'],
      'Check whether a conflict blocks scheduling.',
      ['conflict', 'blocking'],
    ),
    condition(
      'conflict_suggestion',
      'Conflict Suggestion',
      'externalAvailabilityService',
      'conflictSuggestion',
      ['conflictId'],
      'Check whether a conflict is advisory.',
      ['conflict', 'suggestion'],
    ),
    condition(
      'provider_sync_enabled',
      'Provider Sync Enabled',
      'calendarProviderService',
      'providerSyncEnabled',
      ['provider'],
      'Check whether provider sync is enabled.',
      ['sync', 'provider'],
    ),
    condition(
      'personal_calendar_approved',
      'Personal Calendar Approved',
      'calendarProviderService',
      'personalCalendarApproved',
      ['connectionId'],
      'Check whether a personal calendar is approved.',
      ['personal calendar', 'approval'],
    ),
    condition(
      'workspace_calendar_approved',
      'Workspace Calendar Approved',
      'calendarProviderService',
      'workspaceCalendarApproved',
      ['connectionId'],
      'Check whether a workspace calendar is approved.',
      ['workspace calendar', 'approval'],
    ),
  ]

const baseActionFields: NodeConfigField[] = [
  field('eventId', 'Event ID', 'text', {
    placeholder: '{{event.id}}',
    acceptedTypes: ['string'],
    supportsVariables: true,
    semanticRole: 'identifier',
    repairGroup: 'schedulingEvent',
  }),
  field('seriesId', 'Series ID', 'text', {
    placeholder: '{{series.id}}',
    acceptedTypes: ['string'],
    supportsVariables: true,
    semanticRole: 'identifier',
    repairGroup: 'schedulingSeries',
  }),
  field('title', 'Title', 'text', {
    placeholder: 'Follow up with {{client.name}}',
    supportsVariables: true,
    semanticRole: 'title',
    semanticType: 'taskTitle',
    repairGroup: 'schedulingEventDetails',
  }),
  selectField(
    'eventType',
    'Event type',
    [
      'appointment',
      'internalMeeting',
      'scheduledJob',
      'recurringServiceVisit',
      'blockedTime',
    ],
    {
      optionSource: 'scheduling.eventTypes',
      repairGroup: 'schedulingEventDetails',
    },
  ),
  selectField('status', 'Status', eventStatuses, {
    defaultValue: 'scheduled',
    optionSource: 'scheduling.eventStatuses',
    semanticRole: 'status',
    repairGroup: 'schedulingEventDetails',
  }),
  field('startsAt', 'Start time', 'text', {
    placeholder: '{{event.startsAt}}',
    acceptedTypes: ['datetime', 'date', 'string'],
    supportsVariables: true,
    semanticRole: 'datetime',
    repairGroup: 'schedulingTiming',
  }),
  field('endsAt', 'End time', 'text', {
    placeholder: '{{event.endsAt}}',
    acceptedTypes: ['datetime', 'date', 'string'],
    supportsVariables: true,
    semanticRole: 'datetime',
    repairGroup: 'schedulingTiming',
  }),
  field('timezone', 'Timezone', 'text', {
    placeholder: '{{workspace.timezone}}',
    acceptedTypes: ['string'],
    supportsVariables: true,
    semanticRole: 'technical',
    optionSource: 'scheduling.timezones',
    repairGroup: 'schedulingTiming',
  }),
  field('memberId', 'Member', 'text', {
    placeholder: '{{assignment.memberId}}',
    acceptedTypes: ['string'],
    supportsVariables: true,
    semanticRole: 'assignee',
    workspaceOptionCategory: 'members',
    optionSource: 'workspace.members',
    storedValue: 'id',
    repairGroup: 'schedulingAssignment',
  }),
  field('teamId', 'Team', 'text', {
    placeholder: '{{assignment.teamId}}',
    acceptedTypes: ['string'],
    supportsVariables: true,
    semanticRole: 'team',
    workspaceOptionCategory: 'teams',
    optionSource: 'workspace.teams',
    storedValue: 'id',
    repairGroup: 'schedulingAssignment',
  }),
  field('provider', 'Provider', 'select', {
    options: providers.map((value) => ({ label: value, value })),
    optionSource: 'scheduling.providers',
    repairGroup: 'schedulingProvider',
  }),
  field('connectionId', 'Connection ID', 'text', {
    placeholder: '{{providerConnection.id}}',
    supportsVariables: true,
    semanticRole: 'identifier',
    repairGroup: 'schedulingProvider',
  }),
  field('conflictId', 'Conflict ID', 'text', {
    placeholder: '{{conflict.id}}',
    supportsVariables: true,
    semanticRole: 'identifier',
    repairGroup: 'schedulingConflict',
  }),
  field('reason', 'Reason', 'textarea', {
    placeholder: 'Explain the scheduling override.',
    supportsVariables: true,
    semanticRole: 'description',
    repairGroup: 'schedulingConflict',
  }),
]

function fieldsForAction(
  actionDefinition: SchedulingWorkflowActionDefinition,
): NodeConfigField[] {
  const required = new Set(actionDefinition.requiredFields)
  return baseActionFields
    .filter(
      (candidate) =>
        required.has(candidate.id) ||
        optionalActionField(actionDefinition.key, candidate.id),
    )
    .map((candidate) => ({
      ...candidate,
      required: required.has(candidate.id),
      requiredMessage: required.has(candidate.id)
        ? `${candidate.label} is required.`
        : candidate.requiredMessage,
    }))
}

function optionalActionField(
  actionKey: SchedulingWorkflowActionKey,
  fieldId: string,
) {
  if (
    ['create_event', 'update_event', 'reschedule_event'].includes(actionKey)
  ) {
    return [
      'title',
      'eventType',
      'status',
      'startsAt',
      'endsAt',
      'timezone',
      'memberId',
    ].includes(fieldId)
  }
  if (
    ['create_time_off', 'create_availability_exception'].includes(actionKey)
  ) {
    return [
      'title',
      'startsAt',
      'endsAt',
      'timezone',
      'memberId',
      'teamId',
      'reason',
    ].includes(fieldId)
  }
  if (actionKey.includes('calendar') || actionKey.includes('provider')) {
    return ['provider', 'connectionId'].includes(fieldId)
  }
  if (actionKey.includes('conflict'))
    return ['conflictId', 'reason'].includes(fieldId)
  return false
}

function fieldsForCondition(
  conditionDefinition: SchedulingWorkflowConditionDefinition,
): NodeConfigField[] {
  const required = new Set(conditionDefinition.requiredFields)
  return baseActionFields
    .filter(
      (candidate) =>
        required.has(candidate.id) ||
        ['startsAt', 'endsAt', 'provider'].includes(candidate.id),
    )
    .map((candidate) => ({
      ...candidate,
      group: 'Condition',
      required: required.has(candidate.id),
      requiredMessage: required.has(candidate.id)
        ? `${candidate.label} is required.`
        : candidate.requiredMessage,
    }))
}

function schedulingTriggerGroup(key: SchedulingWorkflowTriggerKey) {
  if (key.startsWith('event.')) return 'Event Triggers'
  if (key.startsWith('recurrence.')) return 'Recurrence Triggers'
  if (key.startsWith('time_off.') || key.startsWith('availability_exception.'))
    return 'Availability Triggers'
  if (key.startsWith('calendar.') || key.startsWith('provider.'))
    return 'Provider Triggers'
  if (
    key.startsWith('external_availability.') ||
    key.startsWith('scheduling_conflict.')
  )
    return 'Conflict Triggers'
  if (key.startsWith('reminder.') || key.startsWith('notification.'))
    return 'Notification Triggers'
  return 'Worker Triggers'
}

function schedulingActionType(key: SchedulingWorkflowActionKey) {
  if (key === 'send_scheduling_notification' || key === 'send_reminder')
    return 'communication' as const
  if (
    key === 'connect_calendar' ||
    key === 'disconnect_calendar' ||
    key === 'sync_calendar' ||
    key === 'repair_calendar_mapping' ||
    key === 'retry_provider_sync'
  ) {
    return 'integration' as const
  }
  return 'action' as const
}

function schedulingActionGroup(key: SchedulingWorkflowActionKey) {
  if (key.includes('series')) return 'Recurring Events'
  if (key.includes('calendar') || key.includes('provider'))
    return 'Calendar Providers'
  if (key.includes('notification') || key.includes('reminder'))
    return 'Notifications & Reminders'
  if (key.includes('time_off') || key.includes('availability_exception'))
    return 'Time Off & Exceptions'
  if (key.includes('conflict')) return 'Conflicts'
  return 'Event Actions'
}

function schedulingConditionGroup(key: SchedulingWorkflowConditionKey) {
  if (key.includes('conflict')) return 'Conflicts'
  if (
    key.includes('available') ||
    key.includes('time_off') ||
    key.includes('availability_exception')
  )
    return 'Availability'
  if (key.includes('calendar') || key.includes('provider'))
    return 'Calendar Providers'
  if (key.includes('recurring') || key.includes('one_time'))
    return 'Recurring Events'
  if (key.includes('reminder')) return 'Notifications & Reminders'
  return 'Utilities'
}

function schedulingAliases(values: string[], extra: string[] = []) {
  return Array.from(
    new Set([
      ...values,
      ...extra,
      ...values.flatMap((value) => [
        value.replace(/_/g, ' '),
        value.replace(/\./g, ' '),
      ]),
    ]),
  )
}

function schedulingAvailabilityForAction(key: SchedulingWorkflowActionKey) {
  if (key === 'assign_team') {
    return {
      state: 'comingSoon' as const,
      label: 'Coming soon',
      selectable: false,
      message:
        'Scheduling team assignment is visible for discovery, but the public Scheduling mutation is not available yet.',
    }
  }
  if (key === 'connect_calendar') {
    return {
      state: 'requiresAuthentication' as const,
      label: 'Requires auth',
      selectable: true,
      message:
        'Calendar connections must complete the provider authentication flow before this action can run.',
    }
  }
  return { state: 'available' as const }
}

export const schedulingWorkflowNodeDefinitions: SchedulingWorkflowDefinitionInput[] =
  [
    ...schedulingWorkflowTriggers.map(
      (definition): SchedulingWorkflowDefinitionInput => ({
        id: definition.nodeId,
        type: 'crm-trigger',
        label: definition.label,
        category: SCHEDULING_WORKFLOW_CATEGORY,
        description: definition.description,
        iconKey: 'calendar',
        inputs: [],
        outputs: schedulingTriggerOutputs,
        configFields: [
          field('triggerKey', 'Trigger key', 'text', {
            defaultValue: definition.key,
            group: 'Trigger',
            helpText: 'Stable Scheduling trigger key used by the runtime.',
            semanticRole: 'technical',
          }),
          ...schedulingTriggerFilters,
        ],
        canBeTrigger: true,
        canBeAction: false,
        connectionRole: 'trigger',
        discovery: {
          type: 'trigger',
          domain: 'scheduling',
          group: schedulingTriggerGroup(definition.key),
          aliases: schedulingAliases(definition.keywords, [
            definition.key,
            definition.label,
            'schedule trigger',
            'calendar trigger',
          ]),
          tags: ['scheduling', 'trigger', ...definition.keywords],
          keywords: definition.keywords,
          searchPriority: definition.key.startsWith('event.') ? 8 : 4,
        },
        ui: { icon: 'calendar', color: 'cyan', builderNodeType: 'crm-trigger' },
        aiDescription: `${definition.label}: consumes Scheduling outbox topics ${definition.outboxTopics.join(', ')}.`,
        documentation: `${definition.description} Payloads are normalized from Scheduling domain outbox events and never expose provider secrets. Search terms: ${definition.keywords.join(', ')}.`,
        executePreview: async (node) => ({
          nodeId: node.id,
          triggerKey: definition.key,
          topic: definition.outboxTopics[0],
          event: { id: 'evt_preview', title: 'Preview event' },
          preview: true,
        }),
      }),
    ),
    ...schedulingWorkflowActions.map(
      (definition): SchedulingWorkflowDefinitionInput => ({
        id: definition.nodeId,
        type: 'crm-action',
        label: definition.label,
        category: SCHEDULING_WORKFLOW_CATEGORY,
        description: definition.description,
        iconKey: 'calendar',
        inputs: [
          { id: 'input', label: 'Scheduling input', dataType: 'object' },
        ],
        outputs: actionOutputs,
        configFields: [
          field('actionKey', 'Action key', 'text', {
            defaultValue: definition.key,
            group: 'Action',
            helpText: 'Stable Scheduling action key used by the runtime.',
            semanticRole: 'technical',
          }),
          ...fieldsForAction(definition),
        ],
        canBeTrigger: false,
        canBeAction: true,
        connectionRole: 'action',
        discovery: {
          type: schedulingActionType(definition.key),
          domain: 'scheduling',
          group: schedulingActionGroup(definition.key),
          aliases: schedulingAliases(definition.keywords, [
            definition.key,
            definition.label,
            definition.key === 'assign_member'
              ? 'employee technician staff worker assignee'
              : '',
            definition.key === 'assign_team'
              ? 'crew department group team assignment'
              : '',
            definition.key === 'reschedule_event'
              ? 'move appointment change date change time postpone reschedule meeting'
              : '',
            definition.key === 'create_time_off'
              ? 'pto vacation leave unavailable day off'
              : '',
            definition.key === 'sync_calendar'
              ? 'google outlook microsoft apple caldav refresh calendar provider sync'
              : '',
            definition.key.includes('external_availability')
              ? 'personal calendar google conflict outlook conflict unavailable outside calendar'
              : '',
          ]),
          tags: [
            'scheduling',
            schedulingActionType(definition.key),
            ...definition.keywords,
          ],
          keywords: definition.keywords,
          searchPriority:
            definition.key === 'create_event'
              ? 10
              : definition.key === 'assign_member'
                ? 8
                : 3,
        },
        availability: schedulingAvailabilityForAction(definition.key),
        ui: { icon: 'calendar', color: 'blue', builderNodeType: 'crm-action' },
        aiDescription: `${definition.label}: executes ${definition.operation} through ${definition.service}.`,
        documentation: `${definition.description} Preview mode simulates the mutation; production mode calls Scheduling services and respects Scheduling permissions. Search terms: ${definition.keywords.join(', ')}.`,
        executePreview: async (node) => ({
          nodeId: node.id,
          actionKey: definition.key,
          operation: definition.operation,
          status: 'preview',
          preview: true,
        }),
      }),
    ),
    ...schedulingWorkflowConditions.map(
      (definition): SchedulingWorkflowDefinitionInput => ({
        id: definition.nodeId,
        type: 'or-path',
        label: definition.label,
        category: SCHEDULING_WORKFLOW_CATEGORY,
        description: definition.description,
        iconKey: 'branch',
        inputs: [
          { id: 'input', label: 'Scheduling input', dataType: 'object' },
        ],
        outputs: conditionOutputs,
        configFields: [
          field('conditionKey', 'Condition key', 'text', {
            defaultValue: definition.key,
            group: 'Condition',
            helpText: 'Stable Scheduling condition key used by the runtime.',
            semanticRole: 'technical',
          }),
          ...fieldsForCondition(definition),
        ],
        canBeTrigger: false,
        canBeAction: true,
        connectionRole: 'logic',
        branchRole: 'condition',
        branchMode: 'exclusive',
        branchHandles: ['match', 'fallback'],
        requiredBranchHandles: ['match', 'fallback'],
        defaultPath: 'match',
        fallbackPath: 'fallback',
        branchPaths: [
          {
            pathKey: 'match',
            pathLabel: 'Matches',
            sourceHandle: 'match',
            order: 0,
            required: true,
          },
          {
            pathKey: 'fallback',
            pathLabel: 'Otherwise',
            sourceHandle: 'fallback',
            order: 1,
            isFallback: true,
            required: true,
          },
        ],
        discovery: {
          type: 'condition',
          domain: 'scheduling',
          group: schedulingConditionGroup(definition.key),
          aliases: schedulingAliases(definition.keywords, [
            definition.key,
            definition.label,
            definition.key === 'has_external_availability_conflict'
              ? 'personal calendar google conflict outlook conflict unavailable outside calendar'
              : '',
            definition.key === 'member_available'
              ? 'technician available employee staff worker free'
              : '',
            definition.key === 'team_available'
              ? 'crew available department group free'
              : '',
          ]),
          tags: ['scheduling', 'condition', ...definition.keywords],
          keywords: definition.keywords,
          searchPriority: definition.key.includes('available') ? 7 : 3,
        },
        ui: { icon: 'branch', color: 'amber', builderNodeType: 'or-path' },
        aiDescription: `${definition.label}: evaluates ${definition.operation} through ${definition.service}.`,
        documentation: `${definition.description} Condition evaluation is registry-driven and uses Scheduling services where data access is needed. Search terms: ${definition.keywords.join(', ')}.`,
        executePreview: async (node) => ({
          nodeId: node.id,
          conditionKey: definition.key,
          matches: true,
          reason: 'Preview condition matched.',
          preview: true,
        }),
      }),
    ),
  ]

export const schedulingVariableDefinitions = [
  [
    'Scheduling',
    'scheduling.event_id',
    'Event ID',
    'string',
    'evt_123',
    'Native Scheduling event identifier.',
  ],
  [
    'Scheduling',
    'scheduling.occurrence_id',
    'Occurrence ID',
    'string',
    'occ_123',
    'Recurring occurrence identifier.',
  ],
  [
    'Scheduling',
    'scheduling.series_id',
    'Series ID',
    'string',
    'series_123',
    'Recurring Scheduling series identifier.',
  ],
  [
    'Scheduling',
    'scheduling.start_time',
    'Start Time',
    'datetime',
    '2026-07-30T14:00:00.000Z',
    'Event or occurrence start time.',
  ],
  [
    'Scheduling',
    'scheduling.end_time',
    'End Time',
    'datetime',
    '2026-07-30T15:00:00.000Z',
    'Event or occurrence end time.',
  ],
  [
    'Scheduling',
    'scheduling.timezone',
    'Timezone',
    'string',
    'America/New_York',
    'Workspace or event timezone.',
  ],
  [
    'Scheduling',
    'scheduling.duration_minutes',
    'Duration',
    'duration',
    60,
    'Event duration in minutes.',
  ],
  [
    'Scheduling',
    'scheduling.status',
    'Status',
    'string',
    'scheduled',
    'Scheduling lifecycle status.',
  ],
  [
    'Scheduling',
    'scheduling.assigned_member_id',
    'Assigned Member',
    'string',
    'member_123',
    'Assigned workspace member ID.',
  ],
  [
    'Scheduling',
    'scheduling.assigned_team_id',
    'Assigned Team',
    'string',
    'team_123',
    'Assigned team ID.',
  ],
  [
    'Scheduling',
    'scheduling.linked_client_id',
    'Linked Client',
    'string',
    'client_123',
    'Linked client ID when present.',
  ],
  [
    'Scheduling',
    'scheduling.linked_contact_id',
    'Linked Contact',
    'string',
    'contact_123',
    'Linked contact ID when present.',
  ],
  [
    'Scheduling',
    'scheduling.provider',
    'Provider',
    'string',
    'google',
    'Calendar provider key.',
  ],
  [
    'Scheduling',
    'scheduling.calendar_id',
    'Calendar',
    'string',
    'calendar_123',
    'Connected calendar ID.',
  ],
  [
    'Scheduling',
    'scheduling.conflict_id',
    'Conflict',
    'string',
    'conflict_123',
    'Scheduling or provider conflict ID.',
  ],
  [
    'Scheduling',
    'scheduling.availability_id',
    'Availability',
    'string',
    'availability_123',
    'Availability record ID.',
  ],
  [
    'Scheduling',
    'scheduling.reminder_id',
    'Reminder',
    'string',
    'reminder_123',
    'Scheduling reminder ID.',
  ],
  [
    'Scheduling',
    'scheduling.time_off_id',
    'Time Off',
    'string',
    'timeoff_123',
    'Time Off record ID.',
  ],
  [
    'Scheduling',
    'scheduling.availability_exception_id',
    'Availability Exception',
    'string',
    'exception_123',
    'Availability exception ID.',
  ],
  [
    'Scheduling',
    'scheduling.provider_connection_id',
    'Provider Connection',
    'string',
    'connection_123',
    'Calendar connection ID.',
  ],
  [
    'Scheduling',
    'scheduling.external_availability_signal_id',
    'External Availability Signal',
    'string',
    'signal_123',
    'Privacy-safe external availability signal ID.',
  ],
  [
    'Scheduling',
    'scheduling.purpose',
    'Purpose',
    'string',
    'WORKSPACE_SHARED',
    'Calendar purpose classification.',
  ],
  [
    'Scheduling',
    'scheduling.approval_status',
    'Approval Status',
    'string',
    'APPROVED',
    'Calendar governance approval status.',
  ],
  [
    'Scheduling',
    'scheduling.visibility_mode',
    'Visibility Mode',
    'string',
    'BUSY_ONLY',
    'Calendar visibility mode.',
  ],
] as const

export const schedulingWorkflowTemplates: SchedulingWorkflowTemplate[] = [
  {
    id: 'scheduling.notify-dispatcher-unavailable',
    title: 'Notify dispatcher when technician unavailable',
    category: SCHEDULING_WORKFLOW_CATEGORY,
    description:
      'Starts from external availability conflicts and notifies dispatch before a bad assignment is confirmed.',
    triggerNodeId: 'scheduling.trigger.external_availability_conflict',
    actionNodeIds: ['scheduling.action.send_scheduling_notification'],
    keywords: ['availability', 'dispatcher', 'conflict'],
  },
  {
    id: 'scheduling.customer-rescheduled',
    title: 'Notify customer when event rescheduled',
    category: SCHEDULING_WORKFLOW_CATEGORY,
    description:
      'Starts when Scheduling detects a reschedule and prepares customer-facing notification.',
    triggerNodeId: 'scheduling.trigger.event_rescheduled',
    actionNodeIds: ['scheduling.action.send_scheduling_notification'],
    keywords: ['customer', 'reschedule', 'notification'],
  },
  {
    id: 'scheduling.create-reminder',
    title: 'Automatically create reminder',
    category: SCHEDULING_WORKFLOW_CATEGORY,
    description:
      'Starts from event creation and sends or schedules a reminder through Scheduling notifications.',
    triggerNodeId: 'scheduling.trigger.event_created',
    actionNodeIds: ['scheduling.action.send_reminder'],
    keywords: ['reminder', 'event'],
  },
  {
    id: 'scheduling.sync-after-assignment',
    title: 'Sync provider after assignment',
    category: SCHEDULING_WORKFLOW_CATEGORY,
    description:
      'Starts from assignment changes and asks the provider sync service to reconcile calendars.',
    triggerNodeId: 'scheduling.trigger.event_assigned',
    actionNodeIds: ['scheduling.action.sync_calendar'],
    keywords: ['sync', 'assignment', 'provider'],
  },
  {
    id: 'scheduling.provider-sync-failure',
    title: 'Notify owner when provider sync fails',
    category: SCHEDULING_WORKFLOW_CATEGORY,
    description:
      'Starts from provider sync failure and sends an owner notification.',
    triggerNodeId: 'scheduling.trigger.calendar_sync_failed',
    actionNodeIds: ['scheduling.action.send_scheduling_notification'],
    keywords: ['sync', 'failure', 'owner'],
  },
  {
    id: 'scheduling.series-paused-manager',
    title: 'Notify manager when recurring series paused',
    category: SCHEDULING_WORKFLOW_CATEGORY,
    description:
      'Starts when a recurring series is paused and notifies the responsible manager.',
    triggerNodeId: 'scheduling.trigger.recurrence_series_paused',
    actionNodeIds: ['scheduling.action.send_scheduling_notification'],
    keywords: ['recurrence', 'paused', 'manager'],
  },
  {
    id: 'scheduling.auto-availability-exception',
    title: 'Auto-create availability exception',
    category: SCHEDULING_WORKFLOW_CATEGORY,
    description:
      'Creates an availability exception in response to a Scheduling condition or conflict.',
    triggerNodeId: 'scheduling.trigger.scheduling_conflict_created',
    actionNodeIds: ['scheduling.action.create_availability_exception'],
    keywords: ['availability', 'exception', 'conflict'],
  },
  {
    id: 'scheduling.calendar-repair',
    title: 'Calendar repair workflow',
    category: SCHEDULING_WORKFLOW_CATEGORY,
    description:
      'Starts from worker or mapping failures and runs provider mapping repair.',
    triggerNodeId: 'scheduling.trigger.worker_failure',
    actionNodeIds: ['scheduling.action.repair_calendar_mapping'],
    keywords: ['repair', 'mapping', 'worker'],
  },
]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function sanitizePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizePayload)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key]) =>
          !/(token|secret|password|credential|authorization)/i.test(key),
      )
      .map(([key, item]) => [key, sanitizePayload(item)]),
  )
}

function pickRecord(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
  }
  return null
}

export function createSchedulingTriggerPayload(input: {
  workspaceId: string
  topic: string
  aggregateId?: string
  aggregateType?: string
  payload?: Record<string, unknown>
  createdAt?: Date | string
}): SchedulingWorkflowTriggerPayload {
  const payload = asRecord(sanitizePayload(input.payload))
  const event =
    pickRecord(payload, ['event', 'schedulingEvent']) ??
    (input.aggregateType === 'SchedulingEvent'
      ? { id: input.aggregateId ?? payload.eventId }
      : null)
  const series =
    pickRecord(payload, ['series', 'recurrenceSeries']) ??
    (payload.seriesId ? { id: payload.seriesId } : null)
  const conflict =
    pickRecord(payload, ['conflict']) ??
    (payload.conflictId ? { id: payload.conflictId } : null)
  const providerMetadata = pickRecord(payload, [
    'provider',
    'providerMetadata',
    'calendarProvider',
  ])
  const notificationMetadata = pickRecord(payload, [
    'notification',
    'notificationMetadata',
    'reminder',
  ])
  const availability =
    pickRecord(payload, ['availability', 'availabilityRecord']) ??
    (input.aggregateType === 'SchedulingAvailabilityRecord'
      ? { id: input.aggregateId ?? payload.recordId, kind: payload.kind }
      : null)

  return {
    workspace: {
      id: input.workspaceId,
      timezone: payload.timezone ?? payload.workspaceTimezone,
    },
    actor:
      pickRecord(payload, ['actor']) ??
      (payload.actorUserId || payload.actorWorkspaceMemberId
        ? {
            userId: payload.actorUserId,
            workspaceMemberId: payload.actorWorkspaceMemberId,
          }
        : null),
    event,
    occurrence:
      pickRecord(payload, ['occurrence']) ??
      (payload.occurrenceId ? { id: payload.occurrenceId } : null),
    series,
    timestamps: {
      occurredAt:
        typeof input.createdAt === 'string'
          ? input.createdAt
          : (input.createdAt?.toISOString() ?? new Date().toISOString()),
      startsAt: event?.startsAt ?? payload.startsAt,
      endsAt: event?.endsAt ?? payload.endsAt,
    },
    providerMetadata,
    linkedRecord: pickRecord(payload, ['linkedRecord']),
    assignment:
      pickRecord(payload, ['assignment']) ??
      (payload.memberId || payload.teamId
        ? { memberId: payload.memberId, teamId: payload.teamId }
        : null),
    status: {
      previous: payload.previousStatus,
      current: payload.status ?? event?.status,
      changeType: payload.changeType ?? payload.reason,
    },
    recurrence:
      pickRecord(payload, ['recurrence']) ??
      (series ? { seriesId: series.id } : null),
    conflict,
    providerMapping: pickRecord(payload, ['providerMapping', 'mapping']),
    availability,
    externalAvailability:
      pickRecord(payload, ['externalAvailability']) ??
      (payload.signalIds ? { signalIds: payload.signalIds } : null),
    notificationMetadata,
    raw: {
      topic: input.topic,
      aggregateId: input.aggregateId,
      aggregateType: input.aggregateType,
      ...payload,
    },
  }
}

function normalizeStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function payloadValue(
  payload: SchedulingWorkflowTriggerPayload,
  field: string,
) {
  switch (field) {
    case 'providers':
    case 'provider':
      return (
        payload.providerMetadata?.name ??
        payload.providerMetadata?.provider ??
        payload.raw.provider
      )
    case 'statuses':
    case 'status':
      return payload.status?.current ?? payload.raw.status
    case 'eventType':
      return payload.event?.type ?? payload.raw.eventType
    case 'calendarId':
      return payload.providerMetadata?.calendarId ?? payload.raw.calendarId
    case 'workspaceLocationId':
      return payload.event?.locationId ?? payload.raw.workspaceLocationId
    case 'teamId':
      return payload.assignment?.teamId ?? payload.raw.teamId
    case 'memberId':
      return payload.assignment?.memberId ?? payload.raw.memberId
    case 'purpose':
      return payload.providerMetadata?.purpose ?? payload.raw.purpose
    case 'approvalState':
      return (
        payload.providerMetadata?.approvalStatus ?? payload.raw.approvalStatus
      )
    case 'recurrence':
      return payload.series?.id || payload.event?.recurrenceSeriesId
        ? 'recurring'
        : 'oneTime'
    case 'conflictType':
      return payload.conflict?.type ?? payload.raw.conflictType
    case 'timeOffCategory':
      return payload.availability?.category ?? payload.raw.timeOffCategory
    case 'availabilityCategory':
      return payload.availability?.kind ?? payload.raw.kind
    case 'reminderType':
      return (
        payload.notificationMetadata?.reminderType ?? payload.raw.reminderType
      )
    case 'notificationChannel':
      return (
        payload.notificationMetadata?.channel ?? payload.raw.notificationChannel
      )
    default:
      return payload.raw[field]
  }
}

export function matchesSchedulingTriggerFilters({
  trigger,
  config,
  topic,
  payload,
}: {
  trigger: SchedulingWorkflowTriggerDefinition
  config?: Record<string, unknown>
  topic: string
  payload: SchedulingWorkflowTriggerPayload
}) {
  if (!trigger.outboxTopics.includes(topic)) return false
  for (const [key, expected] of Object.entries(trigger.payloadMatchers ?? {})) {
    const actual =
      payload.raw[key] ??
      payload.status?.[key as keyof typeof payload.status] ??
      payload.availability?.[key]
    if (String(actual ?? '') !== expected) return false
  }
  for (const field of schedulingTriggerFilters) {
    const configured = config?.[field.id]
    if (
      configured === undefined ||
      configured === null ||
      configured === '' ||
      configured === 'any'
    )
      continue
    const actual = payloadValue(payload, field.id)
    if (field.type === 'multi-select') {
      const values = normalizeStringList(configured)
      if (values.length && !values.includes(String(actual ?? ''))) return false
      continue
    }
    if (String(configured) !== String(actual ?? '')) return false
  }
  return true
}

export function getSchedulingWorkflowTriggerByNodeId(nodeId: string) {
  return schedulingWorkflowTriggers.find((trigger) => trigger.nodeId === nodeId)
}

export function getSchedulingWorkflowActionByNodeId(nodeId: string) {
  return schedulingWorkflowActions.find(
    (actionDefinition) => actionDefinition.nodeId === nodeId,
  )
}

export function getSchedulingWorkflowConditionByNodeId(nodeId: string) {
  return schedulingWorkflowConditions.find(
    (conditionDefinition) => conditionDefinition.nodeId === nodeId,
  )
}

export function isSchedulingWorkflowNode(nodeId: string | undefined | null) {
  return typeof nodeId === 'string' && nodeId.startsWith('scheduling.')
}
