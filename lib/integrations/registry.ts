import type { IntegrationAdapter } from './baseAdapter'
import type { IntegrationProvider } from './types'

const adapters = new Map<IntegrationProvider, IntegrationAdapter>()

export function registerIntegrationAdapter(adapter: IntegrationAdapter) {
  adapters.set(adapter.provider, adapter)
}

export function getIntegrationAdapter(
  provider: IntegrationProvider,
): IntegrationAdapter | null {
  return adapters.get(provider) ?? null
}

export function listIntegrationProviders(): IntegrationProvider[] {
  return Array.from(adapters.keys())
}
