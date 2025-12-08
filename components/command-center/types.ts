// components/command-center/types.ts
import type { SidebarIcon } from '@/components/dashboard/sidebar-items'

export type CommandItemType =
  | 'workspace'
  | 'automation'
  | 'member'
  | 'command'
  | 'help'
  | 'onboarding'

export interface CommandItem {
  id: string
  type: CommandItemType
  label: string
  subtitle?: string
  href?: string
  group: string
  icon: SidebarIcon | 'help' | 'search'
  shortcut?: string
  badge?: string
  meta?: Record<string, any>
}
