'use client'

import type { BuilderNodeType } from '../node-types'

export type InspectorTabId =
  | 'config'
  | 'data'
  | 'logs'
  | 'ai'
  | 'tests'
  | 'schedule'
  | 'inputs'
  | 'outputs'
export type InspectorLayoutId = 'compact' | 'standard' | 'wide' | 'unknown'

export interface InspectorLayoutConfig {
  variant: InspectorLayoutId
  tabs: InspectorTabId[]
  badge?: string
}

const defaultLayout: InspectorLayoutConfig = {
  variant: 'standard',
  tabs: ['config', 'data', 'logs'],
  badge: 'Default',
}

export const INSPECTOR_LAYOUTS: Partial<
  Record<BuilderNodeType, InspectorLayoutConfig>
> = {
  trigger: {
    variant: 'compact',
    tabs: ['config', 'logs', 'tests'],
    badge: 'Trigger',
  },
  delay: {
    variant: 'compact',
    tabs: ['config', 'logs'],
    badge: 'Timing',
  },
  webhook: {
    variant: 'standard',
    tabs: ['config', 'data', 'logs'],
    badge: 'Endpoint',
  },
  'ai-llm': {
    variant: 'wide',
    tabs: ['config', 'data', 'logs', 'ai'],
    badge: 'AI',
  },
  'ai-classifier': {
    variant: 'wide',
    tabs: ['config', 'data', 'logs', 'ai'],
    badge: 'AI',
  },
  'ai-splitter': {
    variant: 'wide',
    tabs: ['config', 'data', 'logs', 'ai'],
    badge: 'AI',
  },
  'or-path': {
    variant: 'standard',
    tabs: ['config', 'data', 'logs'],
    badge: 'Logic',
  },
  group: {
    variant: 'compact',
    tabs: ['config'],
    badge: 'Group',
  },
  'crm-trigger': {
    variant: 'standard',
    tabs: ['config', 'data', 'logs'],
    badge: 'CRM',
  },
  'crm-action': {
    variant: 'standard',
    tabs: ['config', 'data', 'logs'],
    badge: 'CRM',
  },
  unknown: {
    variant: 'unknown',
    tabs: ['data', 'logs'],
    badge: 'Unknown',
  },
}

export function getInspectorLayout(nodeType?: BuilderNodeType | string) {
  if (!nodeType) return defaultLayout
  return INSPECTOR_LAYOUTS[nodeType as BuilderNodeType] ?? defaultLayout
}
