// Sales enablement mode.
// Demo watermarking / redacted analytics / time-boxed access.
// No core UX change and no execution coupling.

export type SalesEnablementConfig = {
  demoWatermark: boolean
  redactedAnalytics: boolean
  expiresAt?: string
}

const salesConfig = new Map<string, SalesEnablementConfig>()

export function setSalesEnablementConfig(
  workspaceId: string,
  config: SalesEnablementConfig,
) {
  salesConfig.set(workspaceId, config)
}

export function getSalesEnablementConfig(
  workspaceId: string,
): SalesEnablementConfig | undefined {
  return salesConfig.get(workspaceId)
}
