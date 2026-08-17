import type { Edge, Node } from 'reactflow'

import type { BuilderNodeType } from '@/lib/builder/node-types'

export type BuilderDraftKind =
  | 'qualified-lead-follow-up'
  | 'client-onboarding'
  | 'missed-call-sms'
  | 'proposal-follow-up'
  | 'welcome-first-task'
  | 'review-request-follow-up'
  | 'task-reminder'
  | 'overdue-task-escalation'

type DraftStep = {
  id: string
  type: BuilderNodeType
  label: string
  data?: Record<string, unknown>
}

export const WORKFLOW_STARTER_CATEGORIES = [
  'Sales',
  'CRM',
  'Client Onboarding',
  'Marketing',
  'Internal Operations',
  'Scheduling',
  'AI Assistant',
  'Custom',
] as const

export const WORKFLOW_TEMPLATE_CATEGORIES = [
  'Sales',
  'CRM',
  'Client Onboarding',
  'Marketing',
  'Internal Operations',
  'Scheduling',
  'AI Assistant',
  'Saved',
] as const

export type WorkflowStarterCategory =
  (typeof WORKFLOW_STARTER_CATEGORIES)[number]

export const WORKFLOW_STARTER_OPTIONS: Record<
  WorkflowStarterCategory,
  string[]
> = {
  Sales: [
    'Follow up new lead',
    'Quote follow-up',
    'Missed call recovery',
    'No response sequence',
    'Lost deal re-engagement',
    'Proposal reminder',
  ],
  CRM: [
    'New Lead',
    'Contact Created',
    'Deal Won',
    'Deal Lost',
    'Client Health Changed',
    'Appointment Booked',
    'Invoice Paid',
    'Missed Call',
    'Form Submitted',
  ],
  'Client Onboarding': [
    'Welcome Email',
    'Create Client',
    'Create Project',
    'Assign Team',
    'Kickoff Call',
    'Request Documents',
    'Collect Payment',
    'Send Intake Form',
  ],
  Marketing: [
    'Capture Leads',
    'Nurture Leads',
    'Review Requests',
    'Newsletter',
    'Social Posting',
    'Promotions',
    'Abandoned Form',
  ],
  'Internal Operations': [
    'Employee Onboarding',
    'Daily Reports',
    'Task Assignment',
    'Inventory Alerts',
    'Equipment Maintenance',
    'Weekly Summary',
    'Approval Workflow',
  ],
  Scheduling: [
    'Notify Dispatcher When Technician Unavailable',
    'Notify Customer When Event Rescheduled',
    'Automatically Create Reminder',
    'Sync Provider After Assignment',
    'Notify Owner When Provider Sync Fails',
    'Calendar Repair Workflow',
  ],
  'AI Assistant': [
    'Reply to customers',
    'Summarize tickets',
    'Classify leads',
    'Generate emails',
    'Analyze CRM data',
    'Extract forms',
    'Build reports',
  ],
  Custom: [],
}

export function getDefaultStarterForCategory(category: string) {
  const options =
    WORKFLOW_STARTER_OPTIONS[category as WorkflowStarterCategory] ??
    WORKFLOW_STARTER_OPTIONS.Sales
  return options[0] ?? `${category} workflow`
}

export type BuilderPreviewDraft = {
  name: string
  category: string
  outcome: string
  nodes: Node[]
  edges: Edge[]
}

export const WORKFLOW_LAYOUT_SPACING = {
  horizontalGap: 360,
  verticalGap: 200,
  branchOffset: 160,
  nodeWidth: 220,
} as const

function connectSequential(nodes: Node[]): Edge[] {
  return nodes.slice(1).map((node, index) => ({
    id: `edge-${nodes[index].id}-${node.id}`,
    source: nodes[index].id,
    target: node.id,
    type: 'default',
  }))
}

function createDraft(
  name: string,
  category: string,
  outcome: string,
  steps: DraftStep[],
): BuilderPreviewDraft {
  const nodes = steps.map((step, index) => ({
    id: `${step.id}-${Date.now()}-${index}`,
    type: step.type,
    position: {
      x: index * WORKFLOW_LAYOUT_SPACING.horizontalGap,
      y:
        step.type === 'or-path' || step.type === 'ai-decision'
          ? WORKFLOW_LAYOUT_SPACING.branchOffset
          : 0,
    },
    data: {
      label: step.label,
      ...step.data,
    },
  }))

  return {
    name,
    category,
    outcome,
    nodes,
    edges: connectSequential(nodes),
  }
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function crmTrigger(
  label: string,
  event: string,
  source = 'Skillify CRM',
  description = 'Starts this preview workflow from a matching CRM event.',
): DraftStep {
  return {
    id: `${slug(label)}-trigger`,
    type: 'crm-trigger',
    label,
    data: { event, source, description },
  }
}

function schedulingTrigger(
  label: string,
  registryNodeId: string,
  triggerKey: string,
  description = 'Starts this preview workflow from a Scheduling domain event.',
): DraftStep {
  return {
    id: `${slug(label)}-trigger`,
    type: 'crm-trigger',
    label,
    data: {
      __registryNodeId: registryNodeId,
      triggerKey,
      source: 'Skillify Scheduling',
      description,
    },
  }
}

function schedulingAction(
  label: string,
  registryNodeId: string,
  actionKey: string,
  extra?: Record<string, unknown>,
): DraftStep {
  return {
    id: slug(label),
    type: 'crm-action',
    label,
    data: {
      __registryNodeId: registryNodeId,
      actionKey,
      description:
        'Runs through Skillify Scheduling services during production execution.',
      ...extra,
    },
  }
}

function webhookStep(
  id: string,
  label: string,
  url: string,
  extra?: Record<string, unknown>,
): DraftStep {
  return {
    id,
    type: 'webhook',
    label,
    data: {
      method: 'POST',
      url,
      auth: 'none',
      description: 'Preview-only outbound action. Connect the real app later.',
      ...extra,
    },
  }
}

function delayStep(
  label = 'Wait 1 day',
  duration = 24,
  unit: 'minutes' | 'hours' | 'days' = 'hours',
  description = 'Pauses this preview workflow before the next follow-up step.',
): DraftStep {
  return {
    id: slug(label),
    type: 'delay',
    label,
    data: { duration, unit, description },
  }
}

function taskStep(label: string, extra?: Record<string, unknown>): DraftStep {
  return {
    id: slug(label),
    type: 'crm-action',
    label,
    data: {
      action: 'task.create',
      objectType: 'task',
      description: 'Creates a preview CRM task for the responsible owner.',
      title: label,
      ...extra,
    },
  }
}

function noteStep(
  label: string,
  description = 'Adds a preview note to the related CRM record.',
): DraftStep {
  return {
    id: slug(label),
    type: 'crm-action',
    label,
    data: { action: 'note.add', objectType: 'note', description },
  }
}

function triggerForStarter(category: string, starter: string): DraftStep {
  const key = starter.toLowerCase()
  if (category === 'Scheduling') {
    if (key.includes('unavailable')) {
      return schedulingTrigger(
        'External Availability Conflict',
        'scheduling.trigger.external_availability_conflict',
        'external_availability.conflict',
        'Starts when external availability conflicts with a Scheduling assignment.',
      )
    }
    if (key.includes('rescheduled')) {
      return schedulingTrigger(
        'Event Rescheduled',
        'scheduling.trigger.event_rescheduled',
        'event.rescheduled',
        'Starts when a Scheduling event moves to a new time.',
      )
    }
    if (key.includes('provider') && key.includes('fails')) {
      return schedulingTrigger(
        'Calendar Sync Failed',
        'scheduling.trigger.calendar_sync_failed',
        'calendar.sync_failed',
        'Starts when calendar provider sync fails.',
      )
    }
    if (key.includes('assignment')) {
      return schedulingTrigger(
        'Event Assigned',
        'scheduling.trigger.event_assigned',
        'event.assigned',
        'Starts when a Scheduling event receives an assignment.',
      )
    }
    if (key.includes('repair')) {
      return schedulingTrigger(
        'Worker Failure',
        'scheduling.trigger.worker_failure',
        'worker.failure',
        'Starts when a Scheduling worker or mapping diagnostic reports a failure.',
      )
    }
    return schedulingTrigger(
      'Event Created',
      'scheduling.trigger.event_created',
      'event.created',
      'Starts when a Scheduling event is created.',
    )
  }
  if (key.includes('follow up new lead') || key === 'new lead') {
    return crmTrigger(
      'New Lead Created',
      'lead.created',
      'Skillify CRM',
      'Starts when a new lead enters the sales pipeline.',
    )
  }
  if (key.includes('quote')) {
    return crmTrigger(
      'Quote Sent',
      'opportunity.quote_sent',
      'Skillify CRM',
      'Starts after a quote is sent and needs follow-up.',
    )
  }
  if (key.includes('proposal')) {
    return crmTrigger(
      'Proposal Sent',
      'opportunity.proposal_sent',
      'Skillify CRM',
      'Starts after a proposal is sent and needs a reminder.',
    )
  }
  if (key.includes('no response')) {
    return crmTrigger(
      'No Response Detected',
      'lead.no_response',
      'Skillify CRM',
      'Starts when a lead has not responded after outreach.',
    )
  }
  if (key.includes('missed call') || key.includes('missed caller')) {
    return crmTrigger(
      'Missed Call Logged',
      'service_request.created',
      'Phone',
      'Starts when a missed call is logged for a lead or customer.',
    )
  }
  if (
    key.includes('deal won') ||
    key.includes('won') ||
    key.includes('onboarding')
  ) {
    return crmTrigger(
      'Deal Won',
      'opportunity.won',
      'Skillify CRM',
      'Starts when a deal is marked won.',
    )
  }
  if (key.includes('deal lost') || key.includes('lost deal')) {
    return crmTrigger(
      'Deal Lost',
      'opportunity.lost',
      'Skillify CRM',
      'Starts when a deal is marked lost.',
    )
  }
  if (key.includes('health')) {
    return crmTrigger(
      'Client Health Changed',
      'client.health_changed',
      'Skillify CRM',
      'Starts when a client health score changes.',
    )
  }
  if (key.includes('appointment') || key.includes('kickoff')) {
    return crmTrigger(
      key.includes('kickoff') ? 'Kickoff Call Booked' : 'Appointment Booked',
      'appointment.booked',
      'Calendar',
      'Starts when the appointment is booked.',
    )
  }
  if (key.includes('unpaid invoice') || key.includes('unpaid invoices')) {
    return crmTrigger(
      'Invoice Unpaid',
      'invoice.unpaid',
      'Billing',
      'Starts when an invoice needs payment follow-up.',
    )
  }
  if (key.includes('invoice') || key.includes('payment')) {
    return crmTrigger(
      key.includes('payment') ? 'Payment Collected' : 'Invoice Paid',
      'invoice.paid',
      'Billing',
      'Starts when payment activity is recorded.',
    )
  }
  if (
    key.includes('form') ||
    key.includes('intake') ||
    key.includes('capture')
  ) {
    return crmTrigger(
      key.includes('intake') ? 'Intake Form Submitted' : 'Form Submitted',
      'form.submitted',
      'Website',
      'Starts when a form submission is received.',
    )
  }
  if (key.includes('employee onboarding')) {
    return crmTrigger(
      'Employee Added',
      'employee.created',
      'Skillify Ops',
      'Starts when a new employee onboarding record is created.',
    )
  }
  if (key.includes('daily reports')) {
    return crmTrigger(
      'Daily Report Window Opened',
      'report.daily_due',
      'Skillify Ops',
      'Starts when the daily report workflow should run.',
    )
  }
  if (key.includes('weekly summary')) {
    return crmTrigger(
      'Weekly Summary Scheduled',
      'report.weekly_due',
      'Skillify Ops',
      'Starts when the weekly summary workflow should run.',
    )
  }
  if (key.includes('inventory alerts')) {
    return crmTrigger(
      'Inventory Alert Created',
      'inventory.alert',
      'Skillify Ops',
      'Starts when inventory needs attention.',
    )
  }
  if (key.includes('equipment maintenance')) {
    return crmTrigger(
      'Equipment Issue Logged',
      'task.created',
      'Skillify Ops',
      'Starts when an equipment issue is logged for review.',
    )
  }
  if (key.includes('approval')) {
    return crmTrigger(
      'Approval Request Submitted',
      'approval.requested',
      'Skillify Ops',
      'Starts when an approval request is submitted.',
    )
  }
  if (key.includes('task')) {
    return crmTrigger(
      'Task Created',
      'task.created',
      'Skillify Tasks',
      'Starts when a task is created.',
    )
  }
  if (key.includes('newsletter')) {
    return crmTrigger(
      'Newsletter Signup',
      'lead.newsletter_signup',
      'Marketing',
      'Starts when a person signs up for the newsletter.',
    )
  }
  if (key.includes('review requests')) {
    return crmTrigger(
      'Completed Work Logged',
      'service_request.completed',
      'Skillify CRM',
      'Starts after completed work is ready for a review request.',
    )
  }
  if (
    key.includes('google review') ||
    key.includes('completed job') ||
    key.includes('completed service') ||
    key.includes('after service')
  ) {
    return crmTrigger(
      'Job Completed',
      'service_request.completed',
      'Skillify CRM',
      'Starts when a customer job or service is completed.',
    )
  }
  if (key.includes('social posting')) {
    return crmTrigger(
      'Social Post Requested',
      'marketing.social_requested',
      'Marketing',
      'Starts when a social post needs to be drafted.',
    )
  }
  if (key.includes('promotions')) {
    return crmTrigger(
      'Promotion Scheduled',
      'marketing.promotion_scheduled',
      'Marketing',
      'Starts when a promotion campaign is scheduled.',
    )
  }
  if (key.includes('abandoned form')) {
    return crmTrigger(
      'Abandoned Form Detected',
      'form.abandoned',
      'Website',
      'Starts when a visitor abandons a form.',
    )
  }
  if (key.includes('nurture leads')) {
    return crmTrigger(
      'Lead Entered Nurture',
      'lead.nurture_started',
      'Marketing',
      'Starts when a lead should enter a nurture path.',
    )
  }
  if (key.includes('client') || key.includes('contact')) {
    return crmTrigger(
      key.includes('client') ? 'Client Created' : 'Contact Created',
      key.includes('client') ? 'client.created' : 'contact.created',
      'Skillify CRM',
      'Starts when the record is created.',
    )
  }
  if (category === 'AI Assistant') {
    return crmTrigger(
      'Lead Created',
      'lead.created',
      'Skillify CRM',
      'Starts when a record is ready for AI assistance.',
    )
  }
  return crmTrigger(
    category === 'Internal Operations' ? 'Work Item Created' : 'Lead Created',
    category === 'Internal Operations' ? 'task.created' : 'lead.created',
    category === 'Internal Operations' ? 'Skillify Ops' : 'Skillify CRM',
    category === 'Internal Operations'
      ? 'Starts when an internal work item is ready.'
      : 'Starts when a lead is created.',
  )
}

function starterSteps(category: string, starter: string): DraftStep[] {
  const key = `${category} ${starter}`.toLowerCase()
  const trigger = triggerForStarter(category, starter)

  if (category === 'Scheduling') {
    if (key.includes('repair')) {
      return [
        trigger,
        schedulingAction(
          'Repair Calendar Mapping',
          'scheduling.action.repair_calendar_mapping',
          'repair_calendar_mapping',
          { provider: 'google', repair: true },
        ),
      ]
    }
    if (key.includes('sync provider')) {
      return [
        trigger,
        schedulingAction(
          'Sync Calendar',
          'scheduling.action.sync_calendar',
          'sync_calendar',
          { provider: 'google', connectionId: '{{providerConnection.id}}' },
        ),
      ]
    }
    if (key.includes('reminder')) {
      return [
        trigger,
        schedulingAction(
          'Send Reminder',
          'scheduling.action.send_reminder',
          'send_reminder',
          { eventId: '{{event.id}}' },
        ),
      ]
    }
    if (key.includes('availability exception')) {
      return [
        trigger,
        schedulingAction(
          'Create Availability Exception',
          'scheduling.action.create_availability_exception',
          'create_availability_exception',
          { date: '{{event.startsAt}}', exceptionType: 'closed' },
        ),
      ]
    }
    return [
      trigger,
      schedulingAction(
        'Send Scheduling Notification',
        'scheduling.action.send_scheduling_notification',
        'send_scheduling_notification',
      ),
    ]
  }

  if (
    key.includes('missed call') ||
    key.includes('missed caller') ||
    starter === 'Missed Call'
  ) {
    return [
      crmTrigger(
        'Missed Call Logged',
        'service_request.created',
        'Phone',
        'Starts when a missed call is logged for a lead or customer.',
      ),
      webhookStep(
        'send-sms-reply',
        'Send SMS Reply',
        'https://example.com/sms',
        {
          description:
            'Sends a fast preview SMS response to the missed caller.',
          body: 'Sorry we missed you. How can we help?',
        },
      ),
      delayStep(
        'Wait 30 Minutes',
        30,
        'minutes',
        'Gives the caller time to respond before escalating follow-up.',
      ),
      taskStep('Create Follow-up Task', {
        description:
          'Creates a task for a team member to call the missed caller back.',
        priority: 'High',
      }),
    ]
  }

  if (key.includes('inspection report')) {
    return [
      crmTrigger(
        'Inspection Report Submitted',
        'form.submitted',
        'Operations Form',
        'Starts when an employee submits an inspection report.',
      ),
      taskStep('Create Inspection Review Task', {
        description:
          'Creates a task for an operations lead to review the inspection report.',
        priority: 'Medium',
      }),
      webhookStep(
        'notify-operations-team',
        'Notify Operations Team',
        'https://example.com/notify',
        {
          description:
            'Sends a preview notification that a new inspection report is ready.',
        },
      ),
      delayStep(
        'Wait / Follow-up',
        24,
        'hours',
        'Waits before checking whether the inspection report was reviewed.',
      ),
      taskStep('Mark Inspection for Review', {
        description:
          'Creates a follow-up review task if the inspection still needs action.',
      }),
    ]
  }

  if (
    key.includes('google review') ||
    key.includes('review request') ||
    key.includes('completed job') ||
    key.includes('completed service') ||
    key.includes('after service')
  ) {
    return [
      crmTrigger(
        key.includes('customer') || key.includes('service')
          ? 'Customer Completed Service'
          : 'Job Completed',
        'service_request.completed',
        'Skillify CRM',
        'Starts when a completed job is ready for review follow-up.',
      ),
      webhookStep(
        'send-google-review-request',
        'Send Google Review Request',
        'https://example.com/reviews',
        {
          description: 'Sends a preview Google review request to the customer.',
          subject: 'How was your service?',
        },
      ),
      delayStep(
        'Wait 1 Day',
        1,
        'days',
        'Waits before creating a review follow-up task.',
      ),
      taskStep('Create Review Follow-up Task', {
        description:
          'Creates a task to follow up if the customer has not left a review.',
        priority: 'Medium',
      }),
    ]
  }

  if (key.includes('unpaid invoice') || key.includes('unpaid invoices')) {
    return [
      crmTrigger(
        'Invoice Unpaid',
        'invoice.unpaid',
        'Billing',
        'Starts when an invoice still needs payment follow-up.',
      ),
      webhookStep(
        'send-payment-reminder',
        'Send Payment Reminder',
        'https://example.com/email',
        {
          description: 'Sends a preview reminder for the unpaid invoice.',
          subject: 'Payment reminder',
        },
      ),
      delayStep(
        'Wait 3 Days',
        3,
        'days',
        'Waits before escalating unpaid invoice follow-up.',
      ),
      taskStep('Create Collections Follow-up Task', {
        description:
          'Creates a task for the owner to follow up on the unpaid invoice.',
        priority: 'High',
      }),
    ]
  }

  if (key.includes('classify leads')) {
    return [
      crmTrigger(
        'Lead Created',
        'lead.created',
        'Skillify CRM',
        'Starts when a new lead is created and needs qualification.',
      ),
      {
        id: 'classify-lead',
        type: 'ai-classifier',
        label: 'AI Classifier',
        data: {
          description:
            'Classifies the lead into qualification paths using preview data.',
          categories: ['Hot lead', 'Needs nurture', 'Not a fit'],
          fallback: 'Needs nurture',
        },
      },
      {
        id: 'branch-by-classification',
        type: 'or-path',
        label: 'Condition / Branch',
        data: {
          description:
            'Routes qualified and nurture leads into separate preview paths.',
          conditions: ['Hot lead', 'Needs nurture', 'Not a fit'],
        },
      },
      taskStep('Create Qualified Lead Task', {
        description: 'Creates a sales task when the lead looks qualified.',
        priority: 'High',
      }),
    ]
  }

  if (key.includes('reply to customers') || key.includes('generate emails')) {
    const aiLabel = key.includes('generate emails')
      ? 'Generate Email Draft'
      : 'Draft Customer Reply'
    return [
      trigger,
      {
        id: 'draft-ai-reply',
        type: 'ai-llm',
        label: aiLabel,
        data: {
          description: `Uses AI to ${aiLabel.toLowerCase()} with preview CRM context.`,
          prompt:
            'Write a helpful response using {{client.name}} and the latest record details.',
          model: 'gpt-4.1-mini',
          temperature: 0.2,
        },
      },
      webhookStep(
        'send-ai-message',
        'Send Preview Message',
        'https://example.com/message',
        {
          description:
            'Preview-only message delivery step. Connect the real channel later.',
        },
      ),
      taskStep('Create Human Review Task', {
        description:
          'Creates a review task before any AI-drafted message goes out.',
      }),
    ]
  }

  if (
    key.includes('summarize tickets') ||
    key.includes('analyze crm data') ||
    key.includes('build reports')
  ) {
    const aiLabel = key.includes('build reports')
      ? 'Build Report Summary'
      : key.includes('summarize tickets')
        ? 'Summarize Ticket'
        : 'Analyze CRM Data'
    return [
      trigger,
      {
        id: 'analyze-record',
        type: 'ai-llm',
        label: aiLabel,
        data: {
          description: `Uses AI to ${aiLabel.toLowerCase()} in preview mode.`,
          prompt: 'Summarize the record and highlight next actions.',
          model: 'gpt-4.1-mini',
          temperature: 0.2,
        },
      },
      noteStep(
        'Save AI Summary',
        'Saves the generated AI summary to the related record.',
      ),
      taskStep('Create Review Task', {
        description: 'Creates a task for a person to review the AI output.',
      }),
    ]
  }

  if (key.includes('extract forms')) {
    return [
      trigger,
      {
        id: 'extract-form-fields',
        type: 'ai-splitter',
        label: 'Extract Form Fields',
        data: {
          description: 'Extracts structured form fields from submitted text.',
          mode: 'json',
          schemaHint:
            '{ "name": "string", "email": "string", "request": "string" }',
        },
      },
      noteStep(
        'Save Extracted Details',
        'Saves the extracted fields on the CRM record.',
      ),
      taskStep('Create Intake Review Task', {
        description: 'Creates a review task for the extracted form data.',
      }),
    ]
  }

  if (key.includes('send intake form')) {
    return [
      crmTrigger(
        'Client Created',
        'client.created',
        'Skillify CRM',
        'Starts when a new client record is ready for onboarding.',
      ),
      webhookStep(
        'send-welcome-email',
        'Send Welcome Email',
        'https://example.com/email',
        {
          description: 'Sends the client a preview welcome message.',
          subject: 'Welcome to onboarding',
        },
      ),
      webhookStep(
        'send-intake-form',
        'Send Intake Form',
        'https://example.com/forms/intake',
        {
          description:
            'Sends the onboarding intake form to collect required details.',
          formName: 'Client intake',
        },
      ),
      delayStep(
        'Wait 2 Days',
        2,
        'days',
        'Waits before checking whether the intake form was completed.',
      ),
      taskStep('Create Follow-up Task', {
        description:
          'Creates a task to follow up if the intake form is not complete.',
        priority: 'Medium',
      }),
    ]
  }

  if (
    key.includes('welcome email') ||
    key.includes('create client') ||
    key.includes('create project') ||
    key.includes('assign team') ||
    key.includes('request documents') ||
    key.includes('collect payment')
  ) {
    const onboardingTaskLabel = key.includes('assign team')
      ? 'Assign Onboarding Team'
      : key.includes('create project')
        ? 'Create Project Setup Task'
        : key.includes('request documents')
          ? 'Create Document Request Task'
          : key.includes('collect payment')
            ? 'Create Payment Follow-up Task'
            : 'Create Onboarding Task'
    return [
      trigger,
      noteStep(
        key.includes('create project')
          ? 'Create Project Note'
          : 'Create Client Note',
        `Adds context for ${starter.toLowerCase()} to the client record.`,
      ),
      webhookStep(
        key.includes('collect payment')
          ? 'send-payment-link'
          : 'send-welcome-email',
        key.includes('collect payment')
          ? 'Send Payment Link'
          : 'Send Welcome Email',
        key.includes('collect payment')
          ? 'https://example.com/payments'
          : 'https://example.com/email',
        {
          description: key.includes('collect payment')
            ? 'Sends a preview payment link to the client.'
            : 'Sends the onboarding welcome email in preview mode.',
        },
      ),
      taskStep(onboardingTaskLabel, {
        description: `Creates the next onboarding task for ${starter.toLowerCase()}.`,
      }),
    ]
  }

  if (category === 'Marketing') {
    const messageLabel = key.includes('newsletter')
      ? 'Add to Newsletter'
      : key.includes('review requests')
        ? 'Send Review Request'
        : key.includes('social posting')
          ? 'Create Social Post Draft'
          : key.includes('promotions')
            ? 'Send Promotion'
            : key.includes('abandoned form')
              ? 'Send Abandoned Form Follow-up'
              : 'Send Nurture Message'
    return [
      trigger,
      webhookStep(
        slug(messageLabel),
        messageLabel,
        'https://example.com/marketing',
        {
          description: `Preview action for ${starter.toLowerCase()} marketing outreach.`,
        },
      ),
      delayStep(
        'Wait 2 Days',
        2,
        'days',
        'Waits before creating the next marketing follow-up.',
      ),
      taskStep(
        key.includes('review requests')
          ? 'Create Review Follow-up Task'
          : 'Create Marketing Follow-up Task',
        {
          description: `Creates the next internal task for ${starter.toLowerCase()}.`,
        },
      ),
    ]
  }

  if (category === 'Internal Operations') {
    if (key.includes('equipment maintenance')) {
      return [
        crmTrigger(
          'Equipment Issue Logged',
          'task.created',
          'Skillify Ops',
          'Starts when an equipment issue is logged for review.',
        ),
        taskStep('Create Maintenance Task', {
          description: 'Creates a maintenance task for the operations team.',
          priority: 'High',
        }),
        webhookStep(
          'notify-maintenance-team',
          'Notify Team',
          'https://example.com/notify',
          {
            description:
              'Sends a preview notification to the maintenance team.',
          },
        ),
        delayStep(
          'Wait / Follow-up',
          24,
          'hours',
          'Waits before checking the maintenance task status.',
        ),
        taskStep('Mark for Review', {
          description:
            'Creates a review task if the issue still needs attention.',
          priority: 'Medium',
        }),
      ]
    }
    const opsTaskLabel = key.includes('daily reports')
      ? 'Prepare Daily Report'
      : key.includes('weekly summary')
        ? 'Prepare Weekly Summary'
        : key.includes('inventory alerts')
          ? 'Create Inventory Alert Task'
          : key.includes('approval workflow')
            ? 'Create Approval Task'
            : key.includes('employee onboarding')
              ? 'Create Employee Onboarding Task'
              : 'Assign Internal Task'
    return [
      trigger,
      taskStep(opsTaskLabel, {
        description: `Creates the internal operations task for ${starter.toLowerCase()}.`,
      }),
      webhookStep('notify-team', 'Notify Team', 'https://example.com/notify', {
        description: 'Sends a preview team notification.',
      }),
      delayStep(
        key.includes('daily reports') ? 'Wait Until End of Day' : 'Wait 1 Day',
        key.includes('daily reports') ? 24 : 1,
        key.includes('daily reports') ? 'hours' : 'days',
      ),
      taskStep('Mark for Review', {
        description:
          'Creates a final review task for this operations workflow.',
      }),
    ]
  }

  if (category === 'CRM') {
    const crmTaskLabel = key.includes('deal lost')
      ? 'Create Re-engagement Task'
      : key.includes('deal won')
        ? 'Create Onboarding Handoff Task'
        : key.includes('invoice')
          ? 'Create Payment Follow-up Task'
          : key.includes('health')
            ? 'Create Client Health Review Task'
            : 'Create CRM Follow-up Task'
    return [
      trigger,
      noteStep(
        'Log CRM Activity',
        `Logs the ${starter.toLowerCase()} event on the CRM record.`,
      ),
      taskStep(crmTaskLabel, {
        description: `Creates the appropriate CRM task for ${starter.toLowerCase()}.`,
      }),
      webhookStep(
        'notify-owner',
        'Notify Owner',
        'https://example.com/notify',
        {
          description: 'Sends a preview notification to the record owner.',
        },
      ),
    ]
  }

  const salesMessageLabel = key.includes('quote')
    ? 'Send Quote Follow-up'
    : key.includes('proposal')
      ? 'Send Proposal Reminder'
      : key.includes('no response')
        ? 'Send No-response Follow-up'
        : key.includes('lost deal')
          ? 'Send Re-engagement Email'
          : 'Send New Lead Follow-up'
  const salesTaskLabel = key.includes('lost deal')
    ? 'Create Re-engagement Task'
    : key.includes('proposal')
      ? 'Create Proposal Reminder Task'
      : key.includes('quote')
        ? 'Create Quote Follow-up Task'
        : 'Create Lead Follow-up Task'
  return [
    trigger,
    webhookStep(
      slug(salesMessageLabel),
      salesMessageLabel,
      'https://example.com/email',
      {
        description: `Sends a preview sales message for ${starter.toLowerCase()}.`,
      },
    ),
    delayStep(
      key.includes('no response') ? 'Wait 2 Days' : 'Wait 1 Day',
      key.includes('no response') ? 2 : 1,
      'days',
    ),
    taskStep(salesTaskLabel, {
      description: `Creates the sales owner task for ${starter.toLowerCase()}.`,
    }),
  ]
}

export function createBuilderStarterPreviewDraft(
  category: string,
  starter: string,
): BuilderPreviewDraft {
  const normalizedStarter = starter.trim() || 'New workflow'
  return createDraft(
    `${normalizedStarter} workflow`,
    category,
    `Preview-safe draft for ${category}: ${normalizedStarter}.`,
    starterSteps(category, normalizedStarter),
  )
}

export function createBuilderPreviewDraft(kind: BuilderDraftKind) {
  if (kind === 'proposal-follow-up') {
    return createDraft(
      'Proposal follow-up',
      'Sales',
      'Follow up after a proposal is sent and create next-step work.',
      [
        {
          id: 'proposal-trigger',
          type: 'crm-trigger',
          label: 'When proposal is sent',
          data: { event: 'opportunity.proposal_sent', source: 'Skillify CRM' },
        },
        {
          id: 'wait',
          type: 'delay',
          label: 'Wait 1 day',
          data: { duration: 1, unit: 'days' },
        },
        {
          id: 'email',
          type: 'webhook',
          label: 'Send proposal follow-up',
          data: {
            method: 'POST',
            url: 'https://example.com/email',
            auth: 'none',
          },
        },
        {
          id: 'task',
          type: 'crm-action',
          label: 'Create proposal review task',
          data: { action: 'task.create', objectType: 'task' },
        },
      ],
    )
  }

  if (kind === 'client-onboarding') {
    return createDraft(
      'Client onboarding after won opportunity',
      'Client Onboarding',
      'Start onboarding with notes, instructions, and a kickoff task.',
      [
        {
          id: 'won-trigger',
          type: 'crm-trigger',
          label: 'When opportunity is won',
          data: { event: 'opportunity.won', source: 'Skillify CRM' },
        },
        {
          id: 'add-note',
          type: 'crm-action',
          label: 'Add onboarding note',
          data: { action: 'note.add', objectType: 'client' },
        },
        {
          id: 'send-email',
          type: 'webhook',
          label: 'Send onboarding email',
          data: {
            method: 'POST',
            url: 'https://example.com/email',
            auth: 'none',
          },
        },
        {
          id: 'create-task',
          type: 'crm-action',
          label: 'Create kickoff task',
          data: { action: 'task.create', objectType: 'task' },
        },
      ],
    )
  }

  if (kind === 'welcome-first-task') {
    return createDraft(
      'Welcome email + first task',
      'Client Onboarding',
      'Welcome a new client and assign the first internal deliverable.',
      [
        {
          id: 'client-trigger',
          type: 'crm-trigger',
          label: 'When client is created',
          data: { event: 'client.created', source: 'Skillify CRM' },
        },
        {
          id: 'welcome-email',
          type: 'webhook',
          label: 'Send welcome email',
          data: {
            method: 'POST',
            url: 'https://example.com/email',
            auth: 'none',
          },
        },
        {
          id: 'task',
          type: 'crm-action',
          label: 'Create first deliverable task',
          data: { action: 'task.create', objectType: 'task' },
        },
      ],
    )
  }

  if (kind === 'review-request-follow-up') {
    return createDraft(
      'Review request follow-up',
      'Client Onboarding',
      'Ask for a review after completed client work.',
      [
        {
          id: 'completed-trigger',
          type: 'crm-trigger',
          label: 'When client work is completed',
          data: { event: 'service_request.completed', source: 'Skillify CRM' },
        },
        {
          id: 'wait',
          type: 'delay',
          label: 'Wait 2 hours',
          data: { duration: 2, unit: 'hours' },
        },
        {
          id: 'review-request',
          type: 'webhook',
          label: 'Send review request',
          data: {
            method: 'POST',
            url: 'https://example.com/reviews',
            auth: 'none',
          },
        },
        {
          id: 'note',
          type: 'crm-action',
          label: 'Log review request',
          data: { action: 'note.add', objectType: 'client' },
        },
      ],
    )
  }

  if (kind === 'task-reminder') {
    return createDraft(
      'Task reminder workflow',
      'Internal Operations',
      'Remind owners before important work is due.',
      [
        {
          id: 'task-trigger',
          type: 'crm-trigger',
          label: 'When task is due soon',
          data: { event: 'task.due_soon', source: 'Skillify Tasks' },
        },
        {
          id: 'notify-owner',
          type: 'webhook',
          label: 'Notify task owner',
          data: {
            method: 'POST',
            url: 'https://example.com/notify',
            auth: 'none',
          },
        },
        {
          id: 'note',
          type: 'crm-action',
          label: 'Log reminder activity',
          data: { action: 'note.add', objectType: 'task' },
        },
      ],
    )
  }

  if (kind === 'overdue-task-escalation') {
    return createDraft(
      'Overdue task escalation',
      'Internal Operations',
      'Escalate overdue work and create a manager follow-up.',
      [
        {
          id: 'overdue-trigger',
          type: 'crm-trigger',
          label: 'When task becomes overdue',
          data: { event: 'task.overdue', source: 'Skillify Tasks' },
        },
        {
          id: 'wait',
          type: 'delay',
          label: 'Wait 4 hours',
          data: { duration: 4, unit: 'hours' },
        },
        {
          id: 'escalate',
          type: 'crm-action',
          label: 'Create escalation task',
          data: { action: 'task.create', objectType: 'task' },
        },
      ],
    )
  }

  if (kind === 'missed-call-sms') {
    return createDraft(
      'Missed call SMS follow-up',
      'Sales',
      'Respond quickly to missed calls and create a human follow-up.',
      [
        {
          id: 'call-trigger',
          type: 'crm-trigger',
          label: 'When missed call is logged',
          data: { event: 'service_request.created', source: 'Phone' },
        },
        {
          id: 'send-sms',
          type: 'webhook',
          label: 'Send SMS reply',
          data: {
            method: 'POST',
            url: 'https://example.com/sms',
            auth: 'none',
          },
        },
        {
          id: 'wait',
          type: 'delay',
          label: 'Wait 30 minutes',
          data: { duration: 30, unit: 'minutes' },
        },
        {
          id: 'task',
          type: 'crm-action',
          label: 'Create follow-up task',
          data: { action: 'task.create', objectType: 'task' },
        },
      ],
    )
  }

  return createDraft(
    'Qualified lead follow-up',
    'Sales',
    'Follow up with qualified leads and create a task after a delay.',
    [
      {
        id: 'lead-trigger',
        type: 'crm-trigger',
        label: 'When lead is qualified',
        data: { event: 'lead.converted', source: 'Skillify CRM' },
      },
      {
        id: 'email',
        type: 'webhook',
        label: 'Send follow-up email',
        data: {
          method: 'POST',
          url: 'https://example.com/email',
          auth: 'none',
        },
      },
      {
        id: 'delay',
        type: 'delay',
        label: 'Wait 2 days',
        data: { duration: 2, unit: 'days' },
      },
      {
        id: 'task',
        type: 'crm-action',
        label: 'Create follow-up task',
        data: { action: 'task.create', objectType: 'task' },
      },
    ],
  )
}

export const builderBusinessTemplates = [
  {
    id: 'sales-follow-up',
    group: 'Sales Follow-Up',
    name: 'Qualified lead follow-up',
    outcome: 'Respond to qualified leads and create follow-up work.',
    trigger: 'Lead converted',
    steps: 4,
    tier: 'Pro',
    kind: 'qualified-lead-follow-up' as const,
  },
  {
    id: 'client-onboarding',
    group: 'Client Onboarding',
    name: 'Won opportunity onboarding',
    outcome: 'Start onboarding immediately after a deal is won.',
    trigger: 'Opportunity won',
    steps: 4,
    tier: 'Pro',
    kind: 'client-onboarding' as const,
  },
  {
    id: 'welcome-first-task',
    group: 'Client Onboarding',
    name: 'Welcome email + first task',
    outcome: 'Send a welcome note and assign the first client deliverable.',
    trigger: 'Client created',
    steps: 3,
    tier: 'Pro',
    kind: 'welcome-first-task' as const,
  },
  {
    id: 'review-request-follow-up',
    group: 'Client Onboarding',
    name: 'Review request follow-up',
    outcome: 'Ask happy clients for reviews after completed work.',
    trigger: 'Service request completed',
    steps: 4,
    tier: 'Pro',
    kind: 'review-request-follow-up' as const,
  },
  {
    id: 'missed-call',
    group: 'Missed Call Follow-Up',
    name: 'Missed call SMS follow-up',
    outcome: 'Send a quick SMS and create a human follow-up task.',
    trigger: 'Service request submitted',
    steps: 4,
    tier: 'Pro',
    kind: 'missed-call-sms' as const,
  },
  {
    id: 'proposal-follow-up',
    group: 'Sales Follow-Up',
    name: 'Proposal follow-up',
    outcome: 'Follow up after proposals and create internal next-step work.',
    trigger: 'Proposal sent',
    steps: 4,
    tier: 'Pro',
    kind: 'proposal-follow-up' as const,
  },
  {
    id: 'task-reminder',
    group: 'Internal Operations',
    name: 'Task reminder workflow',
    outcome: 'Notify owners before important tasks are due.',
    trigger: 'Task due soon',
    steps: 3,
    tier: 'Pro',
    kind: 'task-reminder' as const,
  },
  {
    id: 'overdue-task-escalation',
    group: 'Internal Operations',
    name: 'Overdue task escalation',
    outcome: 'Escalate overdue work and create manager follow-up.',
    trigger: 'Task overdue',
    steps: 3,
    tier: 'Pro',
    kind: 'overdue-task-escalation' as const,
  },
]
