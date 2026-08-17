// Template categories.
// UI-only affordance.
// Must not affect execution, permissions, or behavior.
export const TEMPLATE_CATEGORIES = [
  'AI',
  'Integrations',
  'Sales',
  'Ops',
  'Compliance',
] as const

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface UiOnlyTemplateCategoryBrand {
  readonly __uiOnlyBrand?: unique symbol
}

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number] &
  UiOnlyTemplateCategoryBrand
