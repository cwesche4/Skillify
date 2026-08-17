import type { IntegrationHealthResult } from '@/lib/integrations/health'
import type { SafeWorkspaceIntegrationConnection } from '@/lib/integrations/workspaceConnections'
import type {
  WorkspaceSetupProgress,
  WorkspaceSetupStepId,
} from '@/lib/workspaces/workspaceSetup'

export type ReadinessStatus =
  | 'ready'
  | 'readyWithWarnings'
  | 'needsAttention'
  | 'blocked'
  | 'unavailable'
  | 'notConfigured'

export type ReadinessIssueSeverity = 'info' | 'warning' | 'error' | 'blocking'

export type ReadinessIssue = {
  code: string
  severity: ReadinessIssueSeverity
  title: string
  message: string
  module:
    | 'workspace'
    | 'scheduling'
    | 'crm'
    | 'workflowBuilder'
    | 'integrations'
  requiredAction?: string
  destination?: string
  capabilityId?: string
  referenceId?: string
  blocking: boolean
  source: string
}

export type ReadinessResult = {
  moduleId: string
  workspaceId: string
  status: ReadinessStatus
  summary: string
  issues: ReadinessIssue[]
  completedRequirements: string[]
  recommendations: ReadinessIssue[]
  evaluatedAt: string
}

export type WorkspaceReadinessInput = {
  workspaceId: string
  workspaceSlug: string
  setupProgress?: Partial<WorkspaceSetupProgress>
  businessInformationComplete?: boolean
  validWorkingHoursExist?: boolean
  ownerAccessValid?: boolean
  memberCount?: number
  teamCount?: number
  locationCount?: number
  calendarConnections?: SafeWorkspaceIntegrationConnection[]
  providerHealth?: Array<{
    providerId: string
    connectionId?: string
    health: IntegrationHealthResult
  }>
  notificationChannelsConfigured?: boolean
  manualLeadCreationAvailable?: boolean
  automatedLeadSourceConfigured?: boolean
  workspaceAiConfigured?: boolean
  workflowBuilderAvailable?: boolean
}

function setupDestination(workspaceSlug: string, stepId: WorkspaceSetupStepId) {
  return `/dashboard/${workspaceSlug}?setup=1&setupStep=${stepId}`
}

function issue(
  issue: Omit<ReadinessIssue, 'blocking'> & { blocking?: boolean },
): ReadinessIssue {
  return {
    ...issue,
    blocking: issue.blocking ?? issue.severity === 'blocking',
  }
}

function statusFromIssues(issues: ReadinessIssue[]): ReadinessStatus {
  if (issues.some((item) => item.severity === 'blocking')) return 'blocked'
  if (issues.some((item) => item.severity === 'error')) return 'needsAttention'
  if (issues.some((item) => item.severity === 'warning'))
    return 'readyWithWarnings'
  return 'ready'
}

function result({
  moduleId,
  workspaceId,
  summary,
  issues,
  completedRequirements,
}: {
  moduleId: string
  workspaceId: string
  summary: string
  issues: ReadinessIssue[]
  completedRequirements: string[]
}): ReadinessResult {
  const status = statusFromIssues(issues)
  return {
    moduleId,
    workspaceId,
    status,
    summary,
    issues,
    completedRequirements,
    recommendations: issues.filter((item) => !item.blocking),
    evaluatedAt: new Date().toISOString(),
  }
}

export function resolveSchedulingReadiness(
  input: WorkspaceReadinessInput,
): ReadinessResult {
  const issues: ReadinessIssue[] = []
  const completedRequirements: string[] = []

  if (input.validWorkingHoursExist) {
    completedRequirements.push('Valid Working Hours')
  } else {
    issues.push(
      issue({
        code: 'missingWorkingHours',
        severity: 'blocking',
        title: 'Working Hours missing',
        message:
          'Configure valid Working Hours so Scheduling has an authoritative availability baseline.',
        module: 'scheduling',
        requiredAction: 'Configure Working Hours',
        destination: setupDestination(input.workspaceSlug, 'workingHours'),
        source: 'workspaceSetup',
      }),
    )
  }

  if (
    !input.calendarConnections?.some(
      (connection) => connection.status === 'connected',
    )
  ) {
    issues.push(
      issue({
        code: 'noExternalCalendarConnected',
        severity: 'warning',
        title: 'No external calendar connected',
        message:
          'Native Scheduling remains usable. Connect Google or Microsoft Calendar when external availability sync is needed.',
        module: 'scheduling',
        requiredAction: 'Review Calendar Connections',
        destination: setupDestination(input.workspaceSlug, 'calendars'),
        source: 'integrationHealth',
      }),
    )
  }

  for (const health of input.providerHealth ?? []) {
    if (health.health.state === 'healthy') continue
    issues.push(
      issue({
        code: `providerHealth:${health.providerId}`,
        severity:
          health.health.state === 'expired' ||
          health.health.state === 'reconnectRequired'
            ? 'error'
            : 'warning',
        title: `${health.providerId} needs attention`,
        message: health.health.safeMessage,
        module: 'integrations',
        requiredAction: health.health.requiredAction,
        destination: `/dashboard/${input.workspaceSlug}/settings/integrations`,
        referenceId: health.connectionId,
        source: 'integrationHealth',
      }),
    )
  }

  if (!input.notificationChannelsConfigured) {
    issues.push(
      issue({
        code: 'notificationsNotConfirmed',
        severity: 'warning',
        title: 'Notifications not confirmed',
        message:
          'Confirm Scheduling notification preferences so reminders use intentional defaults.',
        module: 'scheduling',
        requiredAction: 'Confirm Notifications',
        destination: setupDestination(input.workspaceSlug, 'notifications'),
        source: 'workspaceSetup',
      }),
    )
  }

  return result({
    moduleId: 'scheduling',
    workspaceId: input.workspaceId,
    summary: 'Scheduling readiness',
    issues,
    completedRequirements,
  })
}

export function resolveCrmReadiness(
  input: WorkspaceReadinessInput,
): ReadinessResult {
  const issues: ReadinessIssue[] = []
  const completedRequirements: string[] = []

  if (input.manualLeadCreationAvailable !== false) {
    completedRequirements.push('Manual Lead creation')
  }

  if (!input.automatedLeadSourceConfigured) {
    issues.push(
      issue({
        code: 'noAutomatedLeadSource',
        severity: 'warning',
        title: 'No automated lead source configured',
        message:
          'CRM remains usable through manual Lead creation. Configure a real intake source when ready.',
        module: 'crm',
        requiredAction: 'Review Website and Lead Intake',
        destination: setupDestination(input.workspaceSlug, 'leadIntake'),
        source: 'leadIntakeRegistry',
      }),
    )
  }

  if ((input.memberCount ?? 1) <= 1) {
    issues.push(
      issue({
        code: 'singleLeadOwner',
        severity: 'warning',
        title: 'Only one workspace member',
        message:
          'Add team members later if Leads, follow-ups, and ownership need to be distributed.',
        module: 'crm',
        requiredAction: 'Review Members and Roles',
        destination: setupDestination(input.workspaceSlug, 'members'),
        source: 'workspaceMembers',
      }),
    )
  }

  return result({
    moduleId: 'crm',
    workspaceId: input.workspaceId,
    summary: 'CRM readiness',
    issues,
    completedRequirements,
  })
}

export function resolveWorkflowBuilderReadiness(
  input: WorkspaceReadinessInput,
): ReadinessResult {
  const issues: ReadinessIssue[] = []
  const completedRequirements =
    input.workflowBuilderAvailable === false
      ? []
      : ['Workflow Builder available']

  if (input.workflowBuilderAvailable === false) {
    issues.push(
      issue({
        code: 'workflowBuilderUnavailable',
        severity: 'error',
        title: 'Workflow Builder unavailable',
        message:
          'Workflow Builder readiness should come from existing workflow validation and capability checks.',
        module: 'workflowBuilder',
        destination: `/dashboard/${input.workspaceSlug}/automations`,
        source: 'workflowValidator',
      }),
    )
  }

  return result({
    moduleId: 'workflowBuilder',
    workspaceId: input.workspaceId,
    summary: 'Workflow Builder readiness',
    issues,
    completedRequirements,
  })
}

export function resolveWorkspaceReadiness(
  input: WorkspaceReadinessInput,
): ReadinessResult {
  const issues: ReadinessIssue[] = []
  const completedRequirements: string[] = []

  if (input.businessInformationComplete) {
    completedRequirements.push('Business Information')
  } else {
    issues.push(
      issue({
        code: 'missingBusinessInformation',
        severity: 'blocking',
        title: 'Business Information missing',
        message:
          'Confirm the workspace business information before finishing setup.',
        module: 'workspace',
        requiredAction: 'Complete Business Information',
        destination: setupDestination(input.workspaceSlug, 'business'),
        source: 'workspaceSetup',
      }),
    )
  }

  if (input.ownerAccessValid !== false) {
    completedRequirements.push('Owner access')
  } else {
    issues.push(
      issue({
        code: 'invalidOwnerAccess',
        severity: 'blocking',
        title: 'Owner access needs attention',
        message:
          'Workspace ownership must be valid before setup can be completed.',
        module: 'workspace',
        destination: `/dashboard/${input.workspaceSlug}/settings/members`,
        source: 'workspacePermissions',
      }),
    )
  }

  const moduleResults = [
    resolveSchedulingReadiness(input),
    resolveCrmReadiness(input),
    resolveWorkflowBuilderReadiness(input),
  ]
  for (const moduleResult of moduleResults) {
    issues.push(...moduleResult.issues)
    completedRequirements.push(...moduleResult.completedRequirements)
  }

  const skippedSteps = Object.entries(input.setupProgress ?? {}).filter(
    ([, status]) => status === 'skipped',
  )
  for (const [stepId] of skippedSteps) {
    issues.push(
      issue({
        code: `setupSkipped:${stepId}`,
        severity: 'info',
        title: 'Optional setup skipped',
        message:
          'Skipped setup is tracked separately from readiness and can be completed later.',
        module: 'workspace',
        destination: setupDestination(
          input.workspaceSlug,
          stepId as WorkspaceSetupStepId,
        ),
        source: 'workspaceSetup',
      }),
    )
  }

  return result({
    moduleId: 'workspace',
    workspaceId: input.workspaceId,
    summary: 'Workspace readiness',
    issues,
    completedRequirements,
  })
}
