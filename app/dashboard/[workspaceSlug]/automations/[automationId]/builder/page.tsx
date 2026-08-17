import BuilderClientShell from './BuilderClientShell'

export default function AutomationBuilderPage({
  params,
}: {
  params: { workspaceSlug: string; automationId: string }
}) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-slate-950">
      <BuilderClientShell
        automationId={params.automationId}
        workspaceId={params.workspaceSlug}
      />
    </div>
  )
}
