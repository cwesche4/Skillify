export type AutomationExecutionNavigationRun = {
  id: string
  status: string
  managedBySimple?: boolean
}

export function getAutomationExecutionHref(
  workspaceSlug: string,
  run: AutomationExecutionNavigationRun,
) {
  if (run.managedBySimple) {
    return `/dashboard/${workspaceSlug}/automations/simple/executions`
  }
  return `/dashboard/${workspaceSlug}/automations/advanced/executions?view=${
    run.status === 'FAILED' ? 'failed' : 'all'
  }&executionId=${run.id}#execution-history`
}

export function getFailedAutomationRunsHref(
  workspaceSlug: string,
  failedRuns: Array<Pick<AutomationExecutionNavigationRun, 'managedBySimple'>>,
) {
  const hasSimple = failedRuns.some((run) => run.managedBySimple)
  const hasAdvanced = failedRuns.some((run) => !run.managedBySimple)
  if (hasSimple && hasAdvanced) return `/dashboard/${workspaceSlug}/automations`
  if (hasSimple) {
    return `/dashboard/${workspaceSlug}/automations/simple/executions`
  }
  return `/dashboard/${workspaceSlug}/automations/advanced/executions?view=failed#execution-history`
}
