// components/dashboard/sidebar-items.ts

import type { Plan } from '@/lib/subscriptions/features'

export type SidebarIcon =
  | 'dashboard'
  | 'automations'
  | 'analytics'
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
  roles?: ('OWNER' | 'ADMIN' | 'MEMBER')[]
  keywords?: string[]
  hotkey?: string
  requiredPlan?: Plan // NEW – if set, treat as premium
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    section: 'Overview',
    label: 'Dashboard',
    href: '/dashboard/:workspace',
    icon: 'dashboard',
  },
  {
    section: 'Automation',
    label: 'Automations',
    href: '/dashboard/:workspace/automations',
    icon: 'automations',
  },
  {
    section: 'Automation',
    label: 'Analytics',
    href: '/dashboard/:workspace/analytics',
    icon: 'analytics',
    requiredPlan: 'Pro', // premium analytics
  },
  {
    section: 'Team',
    label: 'Members',
    href: '/dashboard/:workspace/members',
    icon: 'team',
    roles: ['OWNER', 'ADMIN'],
    requiredPlan: 'Basic',
  },
  {
    section: 'Billing',
    label: 'Billing & Plans',
    href: '/dashboard/:workspace/billing',
    icon: 'billing',
    roles: ['OWNER'],
    requiredPlan: 'Basic',
  },
  {
    section: 'AI',
    label: 'AI Coach',
    href: '/dashboard/:workspace/ai',
    icon: 'ai',
    requiredPlan: 'Pro',
  },
  {
    section: 'Settings',
    label: 'Settings',
    href: '/dashboard/:workspace/settings',
    icon: 'settings',
  },
  {
    section: 'Support',
    label: 'Help & Docs',
    href: '/dashboard/:workspace/help',
    icon: 'help',
  },
]
