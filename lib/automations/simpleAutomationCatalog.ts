import {
  WorkspaceBusinessModel,
  type WorkspaceBusinessModel as WorkspaceBusinessModelValue,
} from '@/lib/prisma/enums'

export type SimpleAutomationKey =
  | 'new-lead-alert'
  | 'lead-follow-up'
  | 'estimate-follow-up'
  | 'appointment-reminder'
  | 'schedule-change-notification'
  | 'job-completion-message'

export type SimpleAutomationCategory = 'leads-sales' | 'scheduling' | 'jobs'

export type SimpleAutomationIcon =
  | 'bell'
  | 'messages'
  | 'estimate'
  | 'appointment'
  | 'schedule-change'
  | 'job-complete'

export type SimpleAutomationAvailability = {
  state: 'available' | 'coming-soon'
  label: 'Available' | 'Coming Soon'
  helpText: string
  requirementLabel?: string
}

export type SimpleAutomationSetupOption = {
  value: string
  label: string
  helpText?: string
  disabled?: boolean
}

export type SimpleAutomationSetupField = {
  id: string
  label: string
  helpText?: string
  control: 'single-choice' | 'multi-choice' | 'toggle'
  options?: SimpleAutomationSetupOption[]
  defaultValue: string | string[] | boolean
  customInput?: {
    whenValue: string
    label: string
    placeholder: string
    suffix?: string
  }
}

export type SimpleAutomationDefinition = {
  key: SimpleAutomationKey
  definitionVersion: number
  title: string
  description: string
  category: SimpleAutomationCategory
  categoryLabel: string
  icon: SimpleAutomationIcon
  availability: SimpleAutomationAvailability
  setupFields: SimpleAutomationSetupField[]
  messagePreview?: string
  supportedWorkspaceModels: WorkspaceBusinessModelValue[]
  recommended?: boolean
  statusHelpText?: string
  activationNotice?: string
}

export type SimpleAutomationInstallationSummary = {
  id: string
  definitionKey: string
  definitionVersion: number
  automationId: string
  config: Record<string, string | string[] | boolean>
  updatedAt: string
  automationStatus: 'INACTIVE' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
}

export type SimpleAutomationReadinessSummary = {
  liveSupported: boolean
  ready: boolean
  requirements: Array<{ code: string; message: string; action?: string }>
}

export const SIMPLE_AUTOMATION_CATEGORY_ORDER: SimpleAutomationCategory[] = [
  'leads-sales',
  'scheduling',
  'jobs',
]

const LEAD_WORKSPACE_MODELS: WorkspaceBusinessModelValue[] = [
  WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
  WorkspaceBusinessModel.CONSULTATIVE_SALES,
  WorkspaceBusinessModel.DIRECT_SALES,
]

const SERVICE_OR_CONSULTATIVE_WORKSPACE_MODELS: WorkspaceBusinessModelValue[] =
  [
    WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
    WorkspaceBusinessModel.CONSULTATIVE_SALES,
  ]

export const SIMPLE_AUTOMATION_CATALOG: SimpleAutomationDefinition[] = [
  {
    key: 'new-lead-alert',
    definitionVersion: 1,
    title: 'New Lead Alert',
    description: 'Let your team know as soon as a new lead comes in.',
    category: 'leads-sales',
    categoryLabel: 'Leads & Sales',
    icon: 'bell',
    recommended: true,
    availability: {
      state: 'available',
      label: 'Available',
      helpText: 'Choose how your team should be notified.',
      requirementLabel:
        'Basic+ for Skillify Leads; Elite and HubSpot for CRM contacts',
    },
    statusHelpText:
      'Live activation supports durable Skillify Leads and, on eligible workspaces, connected HubSpot contacts.',
    supportedWorkspaceModels: LEAD_WORKSPACE_MODELS,
    setupFields: [
      {
        id: 'notification-channel',
        label: 'How should your team be notified?',
        control: 'single-choice',
        defaultValue: 'in-app',
        options: [
          { value: 'in-app', label: 'In-app notification' },
          {
            value: 'email',
            label: 'Email',
            helpText: 'Email delivery is not enabled for this recipe yet.',
            disabled: true,
          },
        ],
      },
      {
        id: 'recipient',
        label: 'Who should be notified?',
        control: 'single-choice',
        defaultValue: 'workspace-owner',
        options: [
          { value: 'workspace-owner', label: 'Workspace owner' },
          {
            value: 'team-member',
            label: 'Selected team member',
            helpText: 'Team member selection is being prepared.',
            disabled: true,
          },
        ],
      },
    ],
  },
  {
    key: 'lead-follow-up',
    definitionVersion: 2,
    title: 'Lead Follow-Up',
    description: 'Remind your team when a Lead is due for follow-up.',
    category: 'leads-sales',
    categoryLabel: 'Leads & Sales',
    icon: 'messages',
    recommended: true,
    availability: {
      state: 'available',
      label: 'Available',
      helpText: 'Choose who receives the internal reminder.',
      requirementLabel: 'Basic+ and durable Skillify Leads',
    },
    statusHelpText:
      'Uses each Lead’s Follow-up date to send a durable in-app reminder.',
    activationNotice:
      'Activation applies to follow-ups established from that point forward; existing follow-up dates are not backfilled.',
    supportedWorkspaceModels: [WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS],
    setupFields: [
      {
        id: 'notification-channel',
        label: 'How should your team be reminded?',
        control: 'single-choice',
        defaultValue: 'in-app',
        options: [{ value: 'in-app', label: 'In-app notification' }],
      },
      {
        id: 'recipient',
        label: 'Who should receive the reminder?',
        control: 'single-choice',
        defaultValue: 'lead-assignee-or-owner',
        options: [
          {
            value: 'lead-assignee-or-owner',
            label: 'Lead assignee',
            helpText: 'Falls back to the workspace owner when unassigned.',
          },
          { value: 'workspace-owner', label: 'Workspace owner' },
        ],
      },
    ],
  },
  {
    key: 'estimate-follow-up',
    definitionVersion: 1,
    title: 'Estimate Follow-Up',
    description: 'Remind customers about estimates that still need a response.',
    category: 'leads-sales',
    categoryLabel: 'Leads & Sales',
    icon: 'estimate',
    availability: {
      state: 'coming-soon',
      label: 'Coming Soon',
      helpText: 'Estimate automation support is still being prepared.',
      requirementLabel: 'Estimate foundation required',
    },
    supportedWorkspaceModels: SERVICE_OR_CONSULTATIVE_WORKSPACE_MODELS,
    setupFields: [
      {
        id: 'estimate-delay',
        label: 'When should Skillify send a reminder?',
        control: 'single-choice',
        defaultValue: '3-days',
        options: [
          { value: '1-day', label: '1 day after sending' },
          { value: '3-days', label: '3 days after sending' },
          { value: '7-days', label: '7 days after sending' },
        ],
      },
    ],
  },
  {
    key: 'appointment-reminder',
    definitionVersion: 2,
    title: 'Appointment Reminder',
    description: 'Remind your team before a scheduled appointment or visit.',
    category: 'scheduling',
    categoryLabel: 'Scheduling',
    icon: 'appointment',
    recommended: true,
    availability: {
      state: 'available',
      label: 'Available',
      helpText: 'Choose when your assigned team should be reminded.',
      requirementLabel: 'Basic+ and Skillify Scheduling',
    },
    statusHelpText:
      'Uses durable Scheduling occurrences to remind assigned team members in Skillify.',
    activationNotice:
      'Activation applies to appointments created or changed from that point forward; existing appointments are not retroactively reconciled.',
    supportedWorkspaceModels: SERVICE_OR_CONSULTATIVE_WORKSPACE_MODELS,
    setupFields: [
      {
        id: 'reminder-offset',
        label: 'When should your team be reminded?',
        control: 'single-choice',
        defaultValue: '1-hour',
        options: [
          { value: '15-minutes', label: '15 minutes before' },
          { value: '30-minutes', label: '30 minutes before' },
          { value: '1-hour', label: '1 hour before' },
          { value: '1-day', label: '1 day before' },
        ],
      },
      {
        id: 'notification-channel',
        label: 'How should your team be notified?',
        control: 'single-choice',
        defaultValue: 'in-app',
        options: [{ value: 'in-app', label: 'In-app notification' }],
      },
      {
        id: 'recipient',
        label: 'Who should receive the reminder?',
        control: 'single-choice',
        defaultValue: 'appointment-assignees-or-owner',
        options: [
          {
            value: 'appointment-assignees-or-owner',
            label: 'Assigned team members',
            helpText: 'Falls back to the workspace owner when unassigned.',
          },
        ],
      },
    ],
    messagePreview:
      'Appointment in {{timeUntil}}: {{appointmentTitle}}.',
  },
  {
    key: 'schedule-change-notification',
    definitionVersion: 2,
    title: 'Schedule Change Notification',
    description: 'Let your team know when an appointment schedule changes.',
    category: 'scheduling',
    categoryLabel: 'Scheduling',
    icon: 'schedule-change',
    availability: {
      state: 'available',
      label: 'Available',
      helpText: 'Choose which appointment changes notify your assigned team.',
      requirementLabel: 'Basic+ and Skillify Scheduling',
    },
    statusHelpText:
      'Uses durable Scheduling changes to notify current assignees in Skillify.',
    activationNotice:
      'Activation applies to future schedule changes and does not replay earlier changes.',
    supportedWorkspaceModels: SERVICE_OR_CONSULTATIVE_WORKSPACE_MODELS,
    setupFields: [
      {
        id: 'changes',
        label: 'Notify your team when:',
        helpText: 'Choose one or more changes.',
        control: 'multi-choice',
        defaultValue: ['time', 'assignment', 'canceled'],
        options: [
          { value: 'time', label: 'Appointment time changes' },
          { value: 'assignment', label: 'Assignment changes' },
          { value: 'canceled', label: 'Appointment is canceled' },
        ],
      },
      {
        id: 'notification-channel',
        label: 'How should your team be notified?',
        control: 'single-choice',
        defaultValue: 'in-app',
        options: [{ value: 'in-app', label: 'In-app notification' }],
      },
      {
        id: 'recipient',
        label: 'Who should receive the notification?',
        control: 'single-choice',
        defaultValue: 'appointment-assignees-or-owner',
        options: [
          {
            value: 'appointment-assignees-or-owner',
            label: 'Current assigned team members',
            helpText: 'Falls back to the workspace owner when unassigned.',
          },
        ],
      },
    ],
    messagePreview: 'Schedule changed: {{appointmentTitle}}.',
  },
  {
    key: 'job-completion-message',
    definitionVersion: 2,
    title: 'Job Completion Message',
    description: 'Let your team know when a Job has been completed.',
    category: 'jobs',
    categoryLabel: 'Jobs',
    icon: 'job-complete',
    availability: {
      state: 'available',
      label: 'Available',
      helpText: 'Choose who receives the internal completion notification.',
      requirementLabel: 'Basic+ and durable Skillify Jobs',
    },
    statusHelpText:
      'Sends a durable in-app notification after an explicit Job completion.',
    supportedWorkspaceModels: [WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS],
    setupFields: [
      {
        id: 'notification-channel',
        label: 'How should your team be notified?',
        control: 'single-choice',
        defaultValue: 'in-app',
        options: [{ value: 'in-app', label: 'In-app notification' }],
      },
      {
        id: 'recipient',
        label: 'Who should receive the notification?',
        control: 'single-choice',
        defaultValue: 'job-assignee-or-owner',
        options: [
          {
            value: 'job-assignee-or-owner',
            label: 'Job assignee',
            helpText: 'Falls back to the workspace owner when unassigned.',
          },
          { value: 'workspace-owner', label: 'Workspace owner' },
        ],
      },
    ],
  },
]

export function getSimpleAutomationsForWorkspace(
  businessModel: WorkspaceBusinessModelValue,
) {
  return SIMPLE_AUTOMATION_CATALOG.filter((definition) =>
    definition.supportedWorkspaceModels.includes(businessModel),
  )
}

export function getSimpleAutomationDefinition(definitionKey: string) {
  return SIMPLE_AUTOMATION_CATALOG.find(
    (definition) => definition.key === definitionKey,
  )
}
