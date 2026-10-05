type Plan = 'Free' | 'Basic' | 'Pro' | 'Elite'

export function PlanUpgradeControls({
  currentPlan,
  canManage,
}: {
  workspaceId: string
  currentPlan: Plan
  canManage: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="text-neutral-text-secondary text-xs font-semibold">
        Current plan: <span className="text-neutral-50">{currentPlan}</span>
      </div>

      <p className="text-neutral-text-secondary max-w-xl text-xs">
        Self-service plan changes are unavailable during the controlled launch.
        Approved pilot access is provisioned separately and no payment-backed
        change can be made from this page.
      </p>
      {!canManage ? (
        <p className="text-neutral-text-secondary text-xs">
          Billing details are read-only for workspace members.
        </p>
      ) : null}
    </div>
  )
}
