// components/dashboard/sidebar-items.ts

import type { Plan } from '@/lib/subscriptions/features'

export type SidebarIcon =
  | 'dashboard'
  | 'leads'
  | 'opportunities'
  | 'salesPipeline'
  | 'automations'
  | 'executions'
  | 'templates'
  | 'analytics'
  | 'reports'
  | 'clients'
  | 'tasks'
  | 'serviceRequests'
  | 'scheduling'
  | 'settings'
  | 'team'
  | 'billing'
  | 'ai'
  | 'help'

export interface SidebarItem {
  label: string
  href: string // TEMPLATE: /dashboard/:workspace/...
  icon: SidebarIcon
  section?: string
  roles?: ('OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER')[]
  keywords?: string[]
  hotkey?: string
  requiredPlan?: Plan // NEW – if set, treat as premium
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    section: 'OVERVIEW',
    label: 'Dashboard',
    href: '/dashboard/:workspace',
    icon: 'dashboard',
  },
  {
    section: 'SALES',
    label: 'Leads',
    href: '/dashboard/:workspace/leads',
    icon: 'leads',
  },
  {
    section: 'SALES',
    label: 'Opportunities',
    href: '/dashboard/:workspace/opportunities',
    icon: 'opportunities',
  },
  {
    section: 'SALES',
    label: 'Sales Pipeline',
    href: '/dashboard/:workspace/sales-pipeline',
    icon: 'salesPipeline',
    roles: ['OWNER', 'ADMIN'],
  },
  {
    section: 'WORKFLOWS',
    label: 'Automations',
    href: '/dashboard/:workspace/automations',
    icon: 'automations',
  },
  {
    section: 'WORKFLOWS',
    label: 'Executions',
    href: '/dashboard/:workspace/executions',
    icon: 'executions',
  },
  {
    section: 'WORKFLOWS',
    label: 'Templates',
    href: '/dashboard/:workspace/templates',
    icon: 'templates',
  },
  {
    section: 'OPERATIONS',
    label: 'Clients',
    href: '/dashboard/:workspace/clients',
    icon: 'clients',
  },
  {
    section: 'OPERATIONS',
    label: 'Tasks',
    href: '/dashboard/:workspace/tasks',
    icon: 'tasks',
    // TODO: Hide Tasks from future external client portal roles. Tasks are intended for internal workspace operators.
  },
  {
    section: 'OPERATIONS',
    label: 'Service Requests',
    href: '/dashboard/:workspace/service-requests',
    icon: 'serviceRequests',
    roles: ['OWNER', 'ADMIN'],
  },
  {
    section: 'ANALYTICS',
    label: 'Analytics',
    href: '/dashboard/:workspace/analytics',
    icon: 'analytics',
  },
  {
    section: 'ANALYTICS',
    label: 'Reports',
    href: '/dashboard/:workspace/reports',
    icon: 'reports',
  },
  {
    section: 'TEAM',
    label: 'Members',
    href: '/dashboard/:workspace/members',
    icon: 'team',
    roles: ['OWNER', 'ADMIN'],
  },
  {
    section: 'AI',
    label: 'AI Coach',
    href: '/dashboard/:workspace/ai-coach',
    icon: 'ai',
  },
  {
    section: 'SETTINGS',
    label: 'Settings',
    href: '/dashboard/:workspace/settings',
    icon: 'settings',
  },
]
