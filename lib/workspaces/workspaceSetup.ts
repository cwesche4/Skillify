export type WorkspaceSetupStepId =
  | 'business'
  | 'structure'
  | 'workingHours'
  | 'members'
  | 'calendars'
  | 'ai'
  | 'leadIntake'
  | 'notifications'
  | 'review'

export type WorkspaceSetupStepStatus =
  | 'notStarted'
  | 'inProgress'
  | 'complete'
  | 'skipped'
  | 'unavailable'
  | 'configurationRequired'
  | 'actionRequired'
  | 'connectionError'

export type WorkspaceSetupProgress = Record<
  WorkspaceSetupStepId,
  WorkspaceSetupStepStatus
>

export type WorkspaceSetupStep = {
  id: WorkspaceSetupStepId
  title: string
  shortTitle: string
  description: string
  whyItMatters: string
  required: boolean
  laterLabel: string
  href: (workspaceSlug: string) => string
  deferred?: boolean
}

export const workspaceSetupSteps: WorkspaceSetupStep[] = [
  {
    id: 'business',
    title: 'Business Information',
    shortTitle: 'Business Information',
    description: 'Confirm the basics Skillify uses across your workspace.',
    whyItMatters:
      'This keeps recommendations, labels, reports, and customer-facing copy aligned with the business.',
    required: true,
    laterLabel: 'Settings',
    href: (workspaceSlug) => `/dashboard/${workspaceSlug}/settings`,
  },
  {
    id: 'workingHours',
    title: 'Working Hours',
    shortTitle: 'Working Hours',
    description:
      'Set normal business hours so Scheduling knows when people are available.',
    whyItMatters:
      'Scheduling uses these hours as the baseline before time off, exceptions, and busy events are applied.',
    required: false,
    laterLabel: 'Scheduling → Team Availability → Working Hours',
    href: (workspaceSlug) =>
      `/dashboard/${workspaceSlug}/scheduling/team-availability`,
  },
  {
    id: 'members',
    title: 'Members and Roles',
    shortTitle: 'Members and Roles',
    description:
      'Stage teammate invitations and assign roles before finishing setup.',
    whyItMatters:
      'Owners and admins can invite teammates once, review pending sends, and avoid sending invites before the workspace is ready.',
    required: false,
    laterLabel: 'Members',
    href: (workspaceSlug) => `/dashboard/${workspaceSlug}/members`,
  },
  {
    id: 'structure',
    title: 'Teams and Business Locations',
    shortTitle: 'Teams and Business Locations',
    description:
      'Add repeatable teams and optional places your work is organized around.',
    whyItMatters:
      'Service teams can assign work, availability, and scheduling rules more clearly after members are staged.',
    required: false,
    laterLabel: 'Settings → Teams and Business Locations',
    href: (workspaceSlug) => `/dashboard/${workspaceSlug}/settings/workspaces`,
  },
  {
    id: 'calendars',
    title: 'Calendar Connections',
    shortTitle: 'Calendar Connections',
    description:
      'Connect supported external calendars from setup when your team is ready.',
    whyItMatters:
      'Native Scheduling works without this. External connections add sync and availability context.',
    required: false,
    laterLabel: 'Scheduling Settings',
    href: (workspaceSlug) => `/dashboard/${workspaceSlug}/scheduling/settings`,
  },
  {
    id: 'ai',
    title: 'Workspace AI',
    shortTitle: 'Workspace AI',
    description:
      'Configure structured AI context that personalizes recommendations for this workspace.',
    whyItMatters:
      'Workspace AI uses configured business context and provider availability. It never needs raw provider keys in onboarding.',
    required: false,
    laterLabel: 'Settings → Workspace AI',
    href: (workspaceSlug) =>
      `/dashboard/${workspaceSlug}/settings#ai-configuration`,
  },
  {
    id: 'leadIntake',
    title: 'Website and Lead Intake',
    shortTitle: 'Website and Lead Intake',
    description:
      'Review supported lead sources and connect only real intake methods.',
    whyItMatters:
      'Lead intake can be connected when the workspace is ready. This step is guidance until form configuration is fully centralized.',
    required: false,
    laterLabel: 'Leads → Lead Sources',
    href: (workspaceSlug) => `/dashboard/${workspaceSlug}/leads`,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    shortTitle: 'Notifications',
    description: 'Confirm where reminders and delivery settings live.',
    whyItMatters:
      'Scheduling reminders and workspace notifications use existing notification settings and provider availability.',
    required: false,
    laterLabel: 'Scheduling Settings',
    href: (workspaceSlug) => `/dashboard/${workspaceSlug}/scheduling/settings`,
  },
  {
    id: 'review',
    title: 'Review and Finish',
    shortTitle: 'Review and Finish',
    description:
      'Review saved configuration, send pending invitations, and finish setup.',
    whyItMatters:
      'Required setup can be complete even when optional integrations are skipped.',
    required: true,
    laterLabel: 'Dashboard',
    href: (workspaceSlug) => `/dashboard/${workspaceSlug}`,
  },
]

export function createInitialWorkspaceSetupProgress(): WorkspaceSetupProgress {
  return workspaceSetupSteps.reduce((progress, step) => {
    progress[step.id] = step.deferred ? 'unavailable' : 'notStarted'
    return progress
  }, {} as WorkspaceSetupProgress)
}

export function getWorkspaceSetupStorageKey(workspaceSlug: string) {
  return `skillify:workspace-setup:${workspaceSlug}`
}

export function normalizeWorkspaceSetupProgress(
  value: unknown,
): WorkspaceSetupProgress {
  const initial = createInitialWorkspaceSetupProgress()
  if (!value || typeof value !== 'object') return initial

  const candidate = value as Partial<Record<string, unknown>>
  for (const step of workspaceSetupSteps) {
    const status = candidate[step.id]
    if (
      status === 'complete' ||
      status === 'skipped' ||
      status === 'notStarted' ||
      status === 'inProgress' ||
      status === 'unavailable' ||
      status === 'configurationRequired' ||
      status === 'actionRequired' ||
      status === 'connectionError'
    ) {
      initial[step.id] = status
    } else if (status === 'incomplete') {
      initial[step.id] = 'notStarted'
    }
  }

  return initial
}

export function getWorkspaceSetupSummary(progress: WorkspaceSetupProgress) {
  const completed = workspaceSetupSteps.filter(
    (step) => progress[step.id] === 'complete',
  ).length
  const skipped = workspaceSetupSteps.filter(
    (step) => progress[step.id] === 'skipped',
  ).length
  const requiredComplete = workspaceSetupSteps
    .filter((step) => step.required)
    .every((step) => progress[step.id] === 'complete')
  const fullyConfigured = workspaceSetupSteps.every(
    (step) => progress[step.id] === 'complete',
  )

  return {
    completed,
    skipped,
    total: workspaceSetupSteps.length,
    requiredComplete,
    fullyConfigured,
  }
}
