// lib/subscriptions/features.ts

export type Plan = 'Free' | 'Basic' | 'Pro' | 'Elite'

/**
 * GLOBAL FEATURE MATRIX
 * ----------------------------------------------
 * Controls access for every page, widget,
 * builder node type, analytics module,
 * AI Coach mode, and admin tool.
 *
 * A1 MODEL (Visible but blurred until upgraded)
 */

export const FeatureMatrix = {
  // ===========================
  // DASHBOARD / CORE
  // ===========================
  'dashboard.activity': ['Free', 'Basic', 'Pro,', 'Elite'],
  'dashboard.widgets': ['Free', 'Basic', 'Pro', 'Elite'],

  // ===========================
  // BUILDER — BASIC CORE
  // ===========================
  'builder.trigger': ['Free', 'Basic', 'Pro', 'Elite'],
  'builder.webhook': ['Free', 'Basic', 'Pro', 'Elite'],
  'builder.delay': ['Free', 'Basic', 'Pro', 'Elite'],

  // ===========================
  // BUILDER — PRO FEATURES
  // ===========================
  'builder.ai-nodes': ['Pro', 'Elite'],
  'builder.group-nodes': ['Pro', 'Elite'],
  'builder.or-nodes': ['Pro', 'Elite'],
  'builder.autolayout-advanced': ['Pro', 'Elite'],
  'builder.history': ['Pro', 'Elite'],
  'builder.templates-premium': ['Pro', 'Elite'],

  // ===========================
  // BUILDER — ELITE ONLY
  // ===========================
  'builder.execution-priority': ['Elite'],
  'builder.autoscale': ['Elite'],
  'builder.ai-improve': ['Elite'],

  // ===========================
  // ANALYTICS
  // ===========================
  'analytics.overview': ['Basic', 'Pro', 'Elite'],
  'analytics.trends': ['Pro', 'Elite'],
  'analytics.heatmap': ['Pro', 'Elite'],
  'analytics.performance-grid': ['Pro', 'Elite'],
  'analytics.anomalies': ['Elite'],
  'analytics.success-insights': ['Elite'],

  // ===========================
  // AI COACH
  // ===========================
  'coach.explain': ['Pro', 'Elite'],
  'coach.optimize': ['Pro', 'Elite'],
  'coach.live': ['Elite'],
  'coach.predictive': ['Elite'],

  // ===========================
  // SIDEBAR / NAVIGATION
  // ===========================
  'nav.analytics': ['Basic', 'Pro', 'Elite'],
  'nav.ai-coach': ['Pro', 'Elite'],
  'nav.billing': ['Free', 'Basic', 'Pro', 'Elite'],
  'nav.team': ['Basic', 'Pro', 'Elite'],
  'nav.admin': ['Elite'],

  // ===========================
  // ADMIN FEATURES
  // ===========================
  'admin.system': ['Elite'],
  'admin.build-requests': ['Elite'],

  // ===========================
  // DONE-FOR-YOU AUTOMATIONS
  // (DFY is available to all, but Elite gets faster SLA)
  // ===========================
  'dfy.request': ['Free', 'Basic', 'Pro', 'Elite'],
  'dfy.priority': ['Elite'],
} as const

// ---- Derived types ----
export type FeatureKey = keyof typeof FeatureMatrix

const PLAN_ORDER: Plan[] = ['Free', 'Basic', 'Pro', 'Elite']

export function planAtLeast(plan: Plan, required: Plan): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(required)
}
