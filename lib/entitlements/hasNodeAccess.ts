import type { BuilderNodeType } from '@/lib/builder/node-types'

export type PremiumNodeKey = BuilderNodeType

interface Entitlements {
  premiumNodes?: PremiumNodeKey[]
}

export function hasNodeAccess(
  nodeType: BuilderNodeType,
  entitlements: Entitlements,
): boolean {
  const list = entitlements.premiumNodes ?? []
  return list.includes(nodeType) || !list.length
}
