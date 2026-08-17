export const ownershipLabels = {
  leads: {
    table: 'Owner',
    drawer: 'Owner',
    filterAll: 'All Owners',
  },
  opportunities: {
    table: 'Owner',
    drawer: 'Owner',
    filterAll: 'All Owners',
  },
  pipeline: {
    table: 'Owner',
    drawer: 'Owner',
    filterAll: 'All Owners',
  },
  clients: {
    table: 'Owner',
    drawer: 'Owner',
    filterAll: 'All Owners',
  },
  tasks: {
    table: 'Assigned To',
    drawer: 'Assigned To',
    filterAll: 'All Assignees',
  },
  serviceRequests: {
    table: 'Assigned To',
    drawer: 'Assigned To',
    fallbackDrawer: 'Assigned To',
    filterAll: 'All Assignees',
  },
} as const

export type OwnershipLabelModule = keyof typeof ownershipLabels
