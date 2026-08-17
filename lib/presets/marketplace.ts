import { featureFlags } from '../config/featureFlags'

export type PresetMarketplaceItem = {
  id: string
  name: string
  description?: string
  sourceOrgId: string
  presetId: string
  presetVersion: number
  tags?: string[]
}

export type PresetMarketplaceState = {
  enabled: boolean
  items: PresetMarketplaceItem[]
}

export function getPresetMarketplaceState(): PresetMarketplaceState {
  // Marketplace is disabled by default and contains no items.
  return {
    enabled: !!featureFlags.presetMarketplace,
    items: [],
  }
}
