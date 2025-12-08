// components/dashboard/sidebar-items.ts

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
  href: string
  icon: SidebarIcon
  section?: string // Grouping inside sidebar
  roles?: ('OWNER' | 'ADMIN' | 'MEMBER')[] // Role-gated items
  keywords?: string[] // Command Center search indexing
  hotkey?: string // Command Center quick-access
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  // ===============================
  // OVERVIEW
  // ===============================
  {
    section: 'Overview',
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'dashboard',
    keywords: ['home', 'overview', 'metrics', 'summary'],
    hotkey: '⌘ ⇧ D',
  },

  // ===============================
  // AUTOMATION SYSTEM
  // ===============================
  {
    section: 'Automation',
    label: 'Automations',
    href: '/dashboard/automations',
    icon: 'automations',
    keywords: ['flows', 'builder', 'workflow', 'logic', 'n8n'],
    hotkey: '⌘ ⇧ A',
  },

  {
    section: 'Automation',
    label: 'Analytics',
    href: '/dashboard/analytics',
    icon: 'analytics',
    keywords: ['charts', 'runs', 'insights', 'failures', 'metrics'],
  },

  // ===============================
  // TEAM & MANAGEMENT
  // ===============================
  {
    section: 'Team',
    label: 'Members',
    href: '/dashboard/workspaces/members',
    icon: 'team',
    roles: ['OWNER', 'ADMIN'],
    keywords: ['members', 'team', 'roles', 'permissions', 'workspace'],
  },

  // ===============================
  // BILLING
  // ===============================
  {
    section: 'Billing',
    label: 'Billing & Plans',
    href: '/dashboard/settings/billing',
    icon: 'billing',
    roles: ['OWNER'],
    keywords: ['payment', 'subscriptions', 'plan', 'tier', 'invoice'],
  },

  // ===============================
  // AI SYSTEM
  // ===============================
  {
    section: 'AI',
    label: 'AI Coach',
    href: '/dashboard/ai',
    icon: 'ai',
    keywords: ['coach', 'sse', 'optimization', 'ai insights', 'live'],
  },

  // ===============================
  // SETTINGS
  // ===============================
  {
    section: 'Settings',
    label: 'Settings',
    href: '/dashboard/settings',
    icon: 'settings',
    keywords: ['preferences', 'workspace settings', 'configuration'],
  },

  // ===============================
  // HELP
  // ===============================
  {
    section: 'Support',
    label: 'Help & Docs',
    href: '/dashboard/help',
    icon: 'help',
    keywords: ['documentation', 'support', 'faq'],
    hotkey: '⌘ ⇧ H',
  },
]
