import { prisma } from '@/lib/db'
import { getSimpleAutomationDefinition } from '@/lib/automations/simpleAutomationCatalog'

const historySummaryByRecipe: Record<
  string,
  { trigger: string; action: string }
> = {
  'new-lead-alert': {
    trigger: 'New Skillify Lead or eligible HubSpot contact',
    action: 'Workspace owner notified in Skillify',
  },
  'lead-follow-up': {
    trigger: 'Lead follow-up became due',
    action: 'Lead assignee or workspace owner reminded in Skillify',
  },
  'appointment-reminder': {
    trigger: 'Appointment reminder became due',
    action: 'Current assignees or workspace owner reminded in Skillify',
  },
  'schedule-change-notification': {
    trigger: 'Qualifying appointment change',
    action: 'Current assignees or workspace owner notified in Skillify',
  },
  'job-completion-message': {
    trigger: 'Job completed',
    action: 'Job assignee or workspace owner notified in Skillify',
  },
}

export async function listSimpleAutomationExecutionHistory({
  workspaceId,
  limit = 100,
}: {
  workspaceId: string
  limit?: number
}) {
  const runs = await prisma.automationRun.findMany({
    where: {
      workspaceId,
      automation: {
        simpleAutomationInstallation: { isNot: null },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: Math.min(Math.max(Math.trunc(limit), 1), 100),
    select: {
      id: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      durationMs: true,
      events: {
        orderBy: { createdAt: 'asc' },
        select: { status: true, message: true },
      },
      automation: {
        select: {
          name: true,
          simpleAutomationInstallation: {
            select: { definitionKey: true },
          },
        },
      },
    },
  })

  return runs.flatMap((run) => {
    const installation = run.automation.simpleAutomationInstallation
    if (!installation) return []
    const definition = getSimpleAutomationDefinition(installation.definitionKey)
    const summary = historySummaryByRecipe[installation.definitionKey] ?? {
      trigger: 'Automation trigger received',
      action: 'Configured in-app action attempted',
    }
    const failure = run.events.find((event) => event.status === 'FAILED')
    return [
      {
        id: run.id,
        recipeKey: installation.definitionKey,
        recipeName: definition?.title ?? run.automation.name,
        trigger: summary.trigger,
        action: summary.action,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        durationMs:
          run.durationMs ??
          (run.finishedAt
            ? run.finishedAt.getTime() - run.startedAt.getTime()
            : null),
        failureReason:
          run.status === 'FAILED'
            ? (failure?.message?.slice(0, 300) ?? 'Execution failed.')
            : null,
      },
    ]
  })
}

export type SimpleAutomationHistoryItem = Awaited<
  ReturnType<typeof listSimpleAutomationExecutionHistory>
>[number]
