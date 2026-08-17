import type { WorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { getVisibleCommerceModules } from '@/lib/commerce/commerceRegistry'
import {
  getSchedulingSectionDefinition,
  getSchedulingSectionLabel,
} from '@/lib/scheduling/schedulingPresetRegistry'
import type { WorkspaceSchedulingSettings } from '@/lib/scheduling/types'
import { getWorkspacePresentationProfile } from '@/lib/workspaces/workspacePresentation'

export type WorkspaceNavigationRole = 'owner' | 'admin' | 'manager' | 'member'

export type WorkspaceNavigationIcon =
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
  | 'customers'
  | 'products'
  | 'orders'
  | 'fulfillment'
  | 'inventory'
  | 'scheduling'
  | 'tasks'
  | 'serviceRequests'
  | 'settings'
  | 'team'
  | 'ai'

export type WorkspaceNavigationItem = {
  label: string
  href: string
  icon: WorkspaceNavigationIcon
  roles?: WorkspaceNavigationRole[]
}

export type WorkspaceNavigationGroup = {
  section: string
  items: WorkspaceNavigationItem[]
}

export function buildWorkspaceNavigation({
  capabilities,
  workspaceSlug,
  role,
  canViewSalesPipeline,
  canViewServiceRequests,
  schedulingSettings,
}: {
  capabilities: WorkspaceCapabilities
  workspaceSlug: string
  role: WorkspaceNavigationRole
  canViewSalesPipeline: boolean
  canViewServiceRequests: boolean
  schedulingSettings?: Pick<
    WorkspaceSchedulingSettings,
    'sectionLabelOverrides'
  > | null
}): WorkspaceNavigationGroup[] {
  const commerceModules = getVisibleCommerceModules().filter(
    (module) => capabilities.modules[module.capability],
  )
  const presentation = getWorkspacePresentationProfile(capabilities)
  const baseGroups: WorkspaceNavigationGroup[] = [
    {
      section: 'OVERVIEW',
      items: [
        {
          label: 'Dashboard',
          href: `/dashboard/${workspaceSlug}`,
          icon: 'dashboard',
        },
      ],
    },
  ]

  const groups: WorkspaceNavigationGroup[] =
    presentation.navigationMode === 'commerce'
      ? [
          ...baseGroups,
          {
            section: 'CUSTOMERS',
            items: commerceModules
              .filter((module) => module.capability === 'customers')
              .map((module) => ({
                label: module.label,
                href: `/dashboard/${workspaceSlug}${module.route}`,
                icon: module.icon,
              })),
          },
          {
            section: 'OPERATIONS',
            items: commerceModules
              .filter((module) => module.capability !== 'customers')
              .map((module) => ({
                label: module.label,
                href: `/dashboard/${workspaceSlug}${module.route}`,
                icon: module.icon,
              })),
          },
          schedulingGroup(workspaceSlug, capabilities, schedulingSettings),
          workflowGroup(workspaceSlug),
          analyticsGroup(workspaceSlug),
          teamGroup(workspaceSlug),
          aiGroup(workspaceSlug),
          settingsGroup(workspaceSlug),
        ]
      : presentation.navigationMode === 'serviceSimple'
        ? [
            ...baseGroups,
            {
              section: 'CUSTOMERS',
              items: [
                ...(capabilities.modules.leads
                  ? [
                      {
                        label: capabilities.terminology.leadPlural,
                        href: `/dashboard/${workspaceSlug}/leads`,
                        icon: 'leads' as const,
                      },
                    ]
                  : []),
                ...(capabilities.modules.clients
                  ? [
                      {
                        label: capabilities.terminology.customerPlural,
                        href: `/dashboard/${workspaceSlug}/clients`,
                        icon: 'customers' as const,
                      },
                    ]
                  : []),
              ],
            },
            {
              section: 'OPERATIONS',
              items: [
                ...(canViewServiceRequests
                  ? [
                      {
                        label: capabilities.terminology.serviceRequestPlural,
                        href: `/dashboard/${workspaceSlug}/service-requests`,
                        icon: 'serviceRequests' as const,
                      },
                    ]
                  : []),
                {
                  label: capabilities.terminology.taskPlural,
                  href: `/dashboard/${workspaceSlug}/tasks`,
                  icon: 'tasks',
                },
              ],
            },
            schedulingGroup(workspaceSlug, capabilities, schedulingSettings),
            workflowGroup(workspaceSlug),
            analyticsGroup(workspaceSlug),
            teamGroup(workspaceSlug),
            aiGroup(workspaceSlug),
            settingsGroup(workspaceSlug),
          ]
        : [
            ...baseGroups,
            {
              section: 'SALES',
              items: [
                ...(capabilities.modules.leads
                  ? [
                      {
                        label: capabilities.terminology.leadPlural,
                        href: `/dashboard/${workspaceSlug}/leads`,
                        icon: 'leads' as const,
                      },
                    ]
                  : []),
                ...(capabilities.modules.opportunities
                  ? [
                      {
                        label: capabilities.terminology.opportunityPlural,
                        href: `/dashboard/${workspaceSlug}/opportunities`,
                        icon: 'opportunities' as const,
                      },
                    ]
                  : []),
                ...(canViewSalesPipeline && capabilities.modules.sales
                  ? [
                      {
                        label: capabilities.terminology.salesLabel,
                        href: `/dashboard/${workspaceSlug}/sales-pipeline`,
                        icon: 'salesPipeline' as const,
                      },
                    ]
                  : []),
              ],
            },
            {
              section: 'OPERATIONS',
              items: [
                ...(capabilities.modules.clients
                  ? [
                      {
                        label: capabilities.terminology.customerPlural,
                        href: `/dashboard/${workspaceSlug}/clients`,
                        icon: 'clients' as const,
                      },
                    ]
                  : []),
                ...(canViewServiceRequests
                  ? [
                      {
                        label: capabilities.terminology.serviceRequestPlural,
                        href: `/dashboard/${workspaceSlug}/service-requests`,
                        icon: 'serviceRequests' as const,
                      },
                    ]
                  : []),
                {
                  label: capabilities.terminology.taskPlural,
                  href: `/dashboard/${workspaceSlug}/tasks`,
                  icon: 'tasks',
                },
              ],
            },
            schedulingGroup(workspaceSlug, capabilities, schedulingSettings),
            workflowGroup(workspaceSlug),
            analyticsGroup(workspaceSlug),
            teamGroup(workspaceSlug),
            aiGroup(workspaceSlug),
            settingsGroup(workspaceSlug),
          ]

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || item.roles.includes(role),
      ),
    }))
    .filter((group) => group.items.length > 0)
}

function schedulingGroup(
  workspaceSlug: string,
  capabilities: WorkspaceCapabilities,
  schedulingSettings?: Pick<
    WorkspaceSchedulingSettings,
    'sectionLabelOverrides'
  > | null,
): WorkspaceNavigationGroup {
  if (!capabilities.scheduling.enabled) {
    return { section: 'SCHEDULING', items: [] }
  }

  const items: WorkspaceNavigationItem[] =
    capabilities.scheduling.visibleSections.map((section) => {
      const definition = getSchedulingSectionDefinition(section)
      return {
        label: getSchedulingSectionLabel({
          sectionKey: section,
          settings: schedulingSettings,
          preferShort: true,
        }),
        href: `/dashboard/${workspaceSlug}${definition.route}`,
        icon: 'scheduling',
      }
    })

  items.push({
    label: 'Scheduling Settings',
    href: `/dashboard/${workspaceSlug}/scheduling/settings`,
    icon: 'settings',
    roles: ['owner', 'admin'],
  })

  return {
    section: 'SCHEDULING',
    items,
  }
}

function workflowGroup(workspaceSlug: string): WorkspaceNavigationGroup {
  return {
    section: 'WORKFLOWS',
    items: [
      {
        label: 'Automations',
        href: `/dashboard/${workspaceSlug}/automations`,
        icon: 'automations',
      },
      {
        label: 'Executions',
        href: `/dashboard/${workspaceSlug}/executions`,
        icon: 'executions',
      },
      {
        label: 'Templates',
        href: `/dashboard/${workspaceSlug}/templates`,
        icon: 'templates',
      },
    ],
  }
}

function analyticsGroup(workspaceSlug: string): WorkspaceNavigationGroup {
  return {
    section: 'ANALYTICS',
    items: [
      {
        label: 'Analytics',
        href: `/dashboard/${workspaceSlug}/analytics`,
        icon: 'analytics',
      },
      {
        label: 'Reports',
        href: `/dashboard/${workspaceSlug}/reports`,
        icon: 'reports',
      },
    ],
  }
}

function teamGroup(workspaceSlug: string): WorkspaceNavigationGroup {
  return {
    section: 'TEAM',
    items: [
      {
        label: 'Members',
        href: `/dashboard/${workspaceSlug}/members`,
        icon: 'team',
        roles: ['owner', 'admin'],
      },
    ],
  }
}

function aiGroup(workspaceSlug: string): WorkspaceNavigationGroup {
  return {
    section: 'AI',
    items: [
      {
        label: 'AI Coach',
        href: `/dashboard/${workspaceSlug}/ai-coach`,
        icon: 'ai',
      },
    ],
  }
}

function settingsGroup(workspaceSlug: string): WorkspaceNavigationGroup {
  const developmentItems: WorkspaceNavigationItem[] =
    process.env.NODE_ENV === 'production'
      ? []
      : [
          {
            label: 'Development Tools',
            href: `/dashboard/${workspaceSlug}/admin/dev-tools`,
            icon: 'settings',
            roles: ['owner', 'admin'],
          },
        ]

  return {
    section: 'SETTINGS',
    items: [
      {
        label: 'Settings',
        href: `/dashboard/${workspaceSlug}/settings`,
        icon: 'settings',
      },
      {
        label: 'Workspace Knowledge',
        href: `/dashboard/${workspaceSlug}/settings/workspace-knowledge`,
        icon: 'ai',
      },
      ...developmentItems,
    ],
  }
}
