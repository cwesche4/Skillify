import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import type {
  SchedulingCapabilities,
  SchedulingEventType,
  SchedulingLinkedRecordRequirement,
  SchedulingLocationRequirement,
  SchedulingLocationType,
  SchedulingPreset,
  SchedulingSectionKey,
  WorkspaceSchedulingSettings,
} from '@/lib/scheduling/types'

export type SchedulingSectionDefinition = {
  key: SchedulingSectionKey
  label: string
  shortLabel: string
  description: string
  route: string
}

export type SchedulingEventTypeDefinition = {
  key: SchedulingEventType
  label: string
  description: string
  sections: SchedulingSectionKey[]
  defaultDurationMinutes?: number
  blocksAvailability?: boolean
  requiresAssignment?: boolean
  requiresLinkedRecord?: boolean
  linkedRecordRequirement?: SchedulingLinkedRecordRequirement
  warnWhenUnlinked?: boolean
  requiresLocation?: boolean
  locationRequirement?: SchedulingLocationRequirement
  allowedLocationTypes?: SchedulingLocationType[]
  defaultLocationType?: SchedulingLocationType
  allowUndeterminedLocation?: boolean
  requiredForCreation?: boolean
}

export type SchedulingPresetDefinition = {
  preset: SchedulingPreset
  label: string
  description: string
  defaultBusinessModel: WorkspaceBusinessModel
  defaultEnabled: boolean
  supportedSections: SchedulingSectionKey[]
  defaultVisibleSections: SchedulingSectionKey[]
  supportedEventTypes: SchedulingEventType[]
  linkSupport: Pick<
    SchedulingCapabilities,
    | 'supportsCustomerLinks'
    | 'supportsClientLinks'
    | 'supportsLeadLinks'
    | 'supportsOpportunityLinks'
    | 'supportsSaleLinks'
    | 'supportsOrderLinks'
    | 'supportsFulfillmentLinks'
    | 'supportsProductLinks'
    | 'supportsJobLinks'
    | 'supportsRecurringSeries'
    | 'supportsPickupWindows'
    | 'supportsDeliveryWindows'
    | 'supportsExternalCalendarSync'
  >
}

export const SCHEDULING_SECTIONS: Record<
  SchedulingSectionKey,
  SchedulingSectionDefinition
> = {
  calendar: {
    key: 'calendar',
    label: 'Calendar',
    shortLabel: 'Calendar',
    description:
      'Unified calendar for scheduled work, meetings, and blocked time.',
    route: '/scheduling/calendar',
  },
  appointments: {
    key: 'appointments',
    label: 'Appointments',
    shortLabel: 'Appointments',
    description:
      'Customer-facing appointments, consultations, estimates, or demonstrations.',
    route: '/scheduling/appointments',
  },
  crmMeetings: {
    key: 'crmMeetings',
    label: 'Sales Meetings',
    shortLabel: 'Sales Meetings',
    description:
      'Meetings connected to leads, opportunities, sales, and clients.',
    route: '/scheduling/crm-meetings',
  },
  scheduledJobs: {
    key: 'scheduledJobs',
    label: 'Scheduled Jobs',
    shortLabel: 'Jobs',
    description:
      'Scheduled service jobs with crew, status, location, and customer context.',
    route: '/scheduling/jobs',
  },
  recurringServices: {
    key: 'recurringServices',
    label: 'Recurring Services',
    shortLabel: 'Recurring Services',
    description: 'Recurring service plans and their next scheduled visits.',
    route: '/scheduling/recurring-services',
  },
  pickupDelivery: {
    key: 'pickupDelivery',
    label: 'Pickup & Delivery Windows',
    shortLabel: 'Pickup & Delivery',
    description:
      'Pickup and delivery windows connected to commerce orders and fulfillments.',
    route: '/scheduling/pickup-delivery',
  },
  installationService: {
    key: 'installationService',
    label: 'Installation & Service',
    shortLabel: 'Installations',
    description:
      'Post-purchase installation, demonstration, or service appointments.',
    route: '/scheduling/installations',
  },
  recurringDeliveries: {
    key: 'recurringDeliveries',
    label: 'Recurring Deliveries',
    shortLabel: 'Recurring Deliveries',
    description:
      'Commerce delivery series distinct from recurring service plans.',
    route: '/scheduling/recurring-deliveries',
  },
  teamAvailability: {
    key: 'teamAvailability',
    label: 'Team Availability',
    shortLabel: 'Team Availability',
    description:
      'Working hours, busy time, blocked time, and team availability.',
    route: '/scheduling/team-availability',
  },
  internalMeetings: {
    key: 'internalMeetings',
    label: 'Internal Meetings',
    shortLabel: 'Internal Meetings',
    description:
      'Workspace-only meetings that are not tied to customer records.',
    route: '/scheduling/internal-meetings',
  },
}

export const SCHEDULING_EVENT_TYPES: Record<
  SchedulingEventType,
  SchedulingEventTypeDefinition
> = {
  serviceAppointment: {
    key: 'serviceAppointment',
    label: 'Service Appointment',
    description: 'A customer-facing service appointment.',
    sections: ['calendar', 'appointments'],
    blocksAvailability: true,
    requiresAssignment: true,
    requiresLinkedRecord: true,
    requiresLocation: true,
    locationRequirement: 'required',
    allowUndeterminedLocation: true,
    allowedLocationTypes: [
      'toBeDetermined',
      'physicalAddress',
      'customerLocation',
    ],
    defaultLocationType: 'customerLocation',
  },
  estimate: {
    key: 'estimate',
    label: 'Estimate',
    description: 'A scheduled estimate or quote visit.',
    sections: ['calendar', 'appointments'],
    blocksAvailability: true,
    requiresAssignment: true,
    requiresLinkedRecord: true,
    requiresLocation: true,
    locationRequirement: 'required',
    allowUndeterminedLocation: true,
    allowedLocationTypes: [
      'toBeDetermined',
      'physicalAddress',
      'customerLocation',
    ],
    defaultLocationType: 'customerLocation',
  },
  siteVisit: {
    key: 'siteVisit',
    label: 'Site Visit',
    description: 'A visit to inspect scope, location, or requirements.',
    sections: ['calendar', 'appointments', 'crmMeetings'],
    blocksAvailability: true,
    requiresAssignment: true,
    requiresLinkedRecord: true,
    requiresLocation: true,
    locationRequirement: 'required',
    allowUndeterminedLocation: true,
    allowedLocationTypes: [
      'toBeDetermined',
      'physicalAddress',
      'customerLocation',
    ],
    defaultLocationType: 'customerLocation',
  },
  scheduledJob: {
    key: 'scheduledJob',
    label: 'Scheduled Job',
    description: 'A planned job performed by a team member or crew.',
    sections: ['calendar', 'scheduledJobs'],
    blocksAvailability: true,
    requiresAssignment: true,
    requiresLinkedRecord: true,
    requiresLocation: true,
    locationRequirement: 'required',
    allowUndeterminedLocation: true,
    allowedLocationTypes: [
      'toBeDetermined',
      'physicalAddress',
      'customerLocation',
    ],
    defaultLocationType: 'customerLocation',
  },
  recurringServiceVisit: {
    key: 'recurringServiceVisit',
    label: 'Recurring Service Visit',
    description: 'An occurrence generated by a recurring service plan.',
    sections: ['calendar', 'recurringServices'],
    blocksAvailability: true,
    requiresAssignment: true,
    requiresLinkedRecord: true,
    requiresLocation: true,
    locationRequirement: 'required',
    allowUndeterminedLocation: true,
    allowedLocationTypes: [
      'toBeDetermined',
      'physicalAddress',
      'customerLocation',
    ],
    defaultLocationType: 'customerLocation',
  },
  discoveryCall: {
    key: 'discoveryCall',
    label: 'Discovery Call',
    description: 'A first sales or qualification conversation.',
    sections: ['calendar', 'appointments', 'crmMeetings'],
    blocksAvailability: true,
    requiresAssignment: true,
    locationRequirement: 'optional',
    allowedLocationTypes: [
      'none',
      'videoMeeting',
      'phoneCall',
      'physicalAddress',
    ],
    defaultLocationType: 'none',
  },
  consultation: {
    key: 'consultation',
    label: 'Consultation',
    description: 'A consultative appointment with a prospect or client.',
    sections: ['calendar', 'appointments', 'crmMeetings'],
    blocksAvailability: true,
    requiresAssignment: true,
    locationRequirement: 'optional',
    allowedLocationTypes: [
      'none',
      'videoMeeting',
      'phoneCall',
      'physicalAddress',
      'customerLocation',
      'workspaceLocation',
    ],
    defaultLocationType: 'none',
  },
  opportunityFollowUp: {
    key: 'opportunityFollowUp',
    label: 'Opportunity Follow-up',
    description: 'A scheduled follow-up connected to an opportunity.',
    sections: ['calendar', 'crmMeetings'],
    blocksAvailability: true,
    requiresAssignment: true,
    requiresLinkedRecord: true,
    locationRequirement: 'optional',
    allowedLocationTypes: [
      'none',
      'videoMeeting',
      'phoneCall',
      'physicalAddress',
    ],
    defaultLocationType: 'none',
  },
  proposalReview: {
    key: 'proposalReview',
    label: 'Proposal Review',
    description: 'A meeting to review a proposal or scope.',
    sections: ['calendar', 'crmMeetings'],
    blocksAvailability: true,
    requiresAssignment: true,
    requiresLinkedRecord: true,
    locationRequirement: 'optional',
    allowedLocationTypes: [
      'none',
      'videoMeeting',
      'phoneCall',
      'workspaceLocation',
    ],
    defaultLocationType: 'none',
  },
  projectMeeting: {
    key: 'projectMeeting',
    label: 'Project Meeting',
    description: 'A meeting connected to a sales or client project.',
    sections: ['calendar', 'crmMeetings'],
    blocksAvailability: true,
    requiresAssignment: true,
    requiresLinkedRecord: true,
    locationRequirement: 'optional',
    allowedLocationTypes: [
      'none',
      'videoMeeting',
      'physicalAddress',
      'workspaceLocation',
      'customerLocation',
    ],
    defaultLocationType: 'none',
  },
  customerPickup: {
    key: 'customerPickup',
    label: 'Customer Pickup',
    description: 'A scheduled customer pickup window.',
    sections: ['calendar', 'pickupDelivery'],
    blocksAvailability: true,
    requiresAssignment: true,
    requiresLinkedRecord: true,
    requiresLocation: true,
    locationRequirement: 'required',
    allowUndeterminedLocation: true,
    allowedLocationTypes: [
      'toBeDetermined',
      'physicalAddress',
      'customerLocation',
    ],
    defaultLocationType: 'customerLocation',
  },
  deliveryWindow: {
    key: 'deliveryWindow',
    label: 'Delivery Window',
    description: 'A scheduled delivery window for an order or fulfillment.',
    sections: ['calendar', 'pickupDelivery'],
    blocksAvailability: true,
    requiresAssignment: true,
    requiresLinkedRecord: true,
    requiresLocation: true,
    locationRequirement: 'required',
    allowUndeterminedLocation: true,
    allowedLocationTypes: [
      'toBeDetermined',
      'physicalAddress',
      'customerLocation',
    ],
    defaultLocationType: 'customerLocation',
  },
  installationAppointment: {
    key: 'installationAppointment',
    label: 'Installation Appointment',
    description: 'An installation or post-purchase service appointment.',
    sections: ['calendar', 'appointments', 'installationService'],
    blocksAvailability: true,
    requiresAssignment: true,
    requiresLinkedRecord: true,
    requiresLocation: true,
    locationRequirement: 'required',
    allowUndeterminedLocation: true,
    allowedLocationTypes: [
      'toBeDetermined',
      'physicalAddress',
      'customerLocation',
    ],
    defaultLocationType: 'customerLocation',
  },
  productDemonstration: {
    key: 'productDemonstration',
    label: 'Product Demonstration',
    description: 'A scheduled product demo.',
    sections: ['calendar', 'appointments', 'installationService'],
    blocksAvailability: true,
    requiresAssignment: true,
    requiresLinkedRecord: true,
    locationRequirement: 'optional',
    allowedLocationTypes: ['none', 'videoMeeting', 'workspaceLocation'],
    defaultLocationType: 'none',
  },
  supplierMeeting: {
    key: 'supplierMeeting',
    label: 'Supplier Meeting',
    description: 'A meeting with a supplier or vendor.',
    sections: ['calendar', 'internalMeetings'],
    blocksAvailability: true,
    requiresAssignment: true,
    locationRequirement: 'optional',
    allowedLocationTypes: ['none', 'videoMeeting', 'workspaceLocation'],
    defaultLocationType: 'none',
  },
  inventoryCount: {
    key: 'inventoryCount',
    label: 'Inventory Count',
    description: 'A scheduled inventory count or stock check.',
    sections: ['calendar', 'internalMeetings'],
    blocksAvailability: true,
    requiresAssignment: true,
    locationRequirement: 'optional',
    allowedLocationTypes: ['none', 'workspaceLocation'],
    defaultLocationType: 'none',
  },
  launchEvent: {
    key: 'launchEvent',
    label: 'Launch Event',
    description: 'A scheduled product, retail, or campaign launch event.',
    sections: ['calendar', 'internalMeetings'],
    blocksAvailability: true,
    requiresAssignment: true,
    locationRequirement: 'optional',
    allowedLocationTypes: ['none', 'workspaceLocation', 'other'],
    defaultLocationType: 'none',
  },
  recurringDelivery: {
    key: 'recurringDelivery',
    label: 'Recurring Delivery',
    description: 'An occurrence generated by a recurring delivery series.',
    sections: ['calendar', 'recurringDeliveries'],
    blocksAvailability: true,
    requiresAssignment: true,
    requiresLinkedRecord: true,
    requiresLocation: true,
    locationRequirement: 'required',
    allowUndeterminedLocation: true,
    allowedLocationTypes: [
      'toBeDetermined',
      'physicalAddress',
      'customerLocation',
    ],
    defaultLocationType: 'customerLocation',
  },
  internalMeeting: {
    key: 'internalMeeting',
    label: 'Internal Meeting',
    description: 'A workspace-only meeting.',
    sections: ['calendar', 'internalMeetings'],
    blocksAvailability: true,
    requiredForCreation: true,
    locationRequirement: 'optional',
    allowedLocationTypes: ['none', 'videoMeeting', 'workspaceLocation'],
    defaultLocationType: 'none',
  },
  blockedTime: {
    key: 'blockedTime',
    label: 'Blocked Time',
    description: 'Time reserved to prevent scheduling conflicts.',
    sections: ['calendar', 'teamAvailability', 'internalMeetings'],
    blocksAvailability: true,
    locationRequirement: 'notAllowed',
    allowedLocationTypes: ['none'],
    defaultLocationType: 'none',
  },
}

const serviceEventTypes: SchedulingEventType[] = [
  'serviceAppointment',
  'estimate',
  'siteVisit',
  'scheduledJob',
  'recurringServiceVisit',
  'internalMeeting',
  'blockedTime',
]

const consultativeEventTypes: SchedulingEventType[] = [
  'discoveryCall',
  'consultation',
  'siteVisit',
  'opportunityFollowUp',
  'proposalReview',
  'projectMeeting',
  'internalMeeting',
  'blockedTime',
]

const commerceEventTypes: SchedulingEventType[] = [
  'customerPickup',
  'deliveryWindow',
  'installationAppointment',
  'productDemonstration',
  'supplierMeeting',
  'inventoryCount',
  'launchEvent',
  'recurringDelivery',
  'internalMeeting',
  'blockedTime',
]

export const SCHEDULING_PRESETS: Record<
  SchedulingPreset,
  SchedulingPresetDefinition
> = {
  service: {
    preset: 'service',
    label: 'Service Scheduling',
    description:
      'Appointments, scheduled jobs, recurring services, and team availability.',
    defaultBusinessModel: WorkspaceBusinessModel.DIRECT_SALES,
    defaultEnabled: true,
    supportedSections: [
      'calendar',
      'appointments',
      'scheduledJobs',
      'recurringServices',
      'teamAvailability',
      'internalMeetings',
    ],
    defaultVisibleSections: [
      'calendar',
      'appointments',
      'scheduledJobs',
      'recurringServices',
      'teamAvailability',
    ],
    supportedEventTypes: serviceEventTypes,
    linkSupport: {
      supportsCustomerLinks: false,
      supportsClientLinks: true,
      supportsLeadLinks: true,
      supportsOpportunityLinks: false,
      supportsSaleLinks: true,
      supportsOrderLinks: false,
      supportsFulfillmentLinks: false,
      supportsProductLinks: false,
      supportsJobLinks: true,
      supportsRecurringSeries: true,
      supportsPickupWindows: false,
      supportsDeliveryWindows: false,
      supportsExternalCalendarSync: false,
    },
  },
  consultative: {
    preset: 'consultative',
    label: 'Consultative Scheduling',
    description:
      'Sales meetings, client meetings, appointments, and team availability.',
    defaultBusinessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
    defaultEnabled: true,
    supportedSections: [
      'calendar',
      'appointments',
      'crmMeetings',
      'teamAvailability',
      'scheduledJobs',
      'recurringServices',
      'internalMeetings',
    ],
    defaultVisibleSections: [
      'calendar',
      'appointments',
      'crmMeetings',
      'teamAvailability',
    ],
    supportedEventTypes: consultativeEventTypes,
    linkSupport: {
      supportsCustomerLinks: false,
      supportsClientLinks: true,
      supportsLeadLinks: true,
      supportsOpportunityLinks: true,
      supportsSaleLinks: true,
      supportsOrderLinks: false,
      supportsFulfillmentLinks: false,
      supportsProductLinks: false,
      supportsJobLinks: false,
      supportsRecurringSeries: true,
      supportsPickupWindows: false,
      supportsDeliveryWindows: false,
      supportsExternalCalendarSync: false,
    },
  },
  commerce: {
    preset: 'commerce',
    label: 'Commerce Scheduling',
    description:
      'Pickup, delivery, installation, product events, and internal calendar work.',
    defaultBusinessModel: WorkspaceBusinessModel.PRODUCT_COMMERCE,
    defaultEnabled: false,
    supportedSections: [
      'calendar',
      'pickupDelivery',
      'appointments',
      'installationService',
      'internalMeetings',
      'teamAvailability',
      'recurringDeliveries',
    ],
    defaultVisibleSections: ['calendar', 'pickupDelivery'],
    supportedEventTypes: commerceEventTypes,
    linkSupport: {
      supportsCustomerLinks: true,
      supportsClientLinks: false,
      supportsLeadLinks: false,
      supportsOpportunityLinks: false,
      supportsSaleLinks: false,
      supportsOrderLinks: true,
      supportsFulfillmentLinks: true,
      supportsProductLinks: true,
      supportsJobLinks: false,
      supportsRecurringSeries: true,
      supportsPickupWindows: true,
      supportsDeliveryWindows: true,
      supportsExternalCalendarSync: false,
    },
  },
}

export function getDefaultSchedulingPresetForBusinessModel(
  businessModel: WorkspaceBusinessModel | string,
): SchedulingPreset {
  if (businessModel === WorkspaceBusinessModel.CONSULTATIVE_SALES)
    return 'consultative'
  if (businessModel === WorkspaceBusinessModel.PRODUCT_COMMERCE)
    return 'commerce'
  return 'service'
}

export function getSchedulingSectionDefinition(section: SchedulingSectionKey) {
  return SCHEDULING_SECTIONS[section]
}

export function sanitizeSchedulingSectionLabel(value: unknown) {
  if (typeof value !== 'string') return null
  const label = value.replace(/\s+/g, ' ').trim()
  if (label.length < 2 || label.length > 40) return null
  if (/[\u0000-\u001F\u007F<>]/.test(label)) return null
  if (!/[A-Za-z0-9]/.test(label)) return null
  return label
}

export function getSchedulingSectionLabel({
  sectionKey,
  settings,
  preferShort = false,
}: {
  sectionKey: SchedulingSectionKey
  settings?: Pick<WorkspaceSchedulingSettings, 'sectionLabelOverrides'> | null
  preferShort?: boolean
}) {
  const definition = getSchedulingSectionDefinition(sectionKey)
  const override = sanitizeSchedulingSectionLabel(
    settings?.sectionLabelOverrides?.[sectionKey],
  )
  return override ?? (preferShort ? definition.shortLabel : definition.label)
}

export function getSchedulingSectionDescription(section: SchedulingSectionKey) {
  return getSchedulingSectionDefinition(section).description
}

function labelFromEventTypeKey(type: string) {
  return (
    type
      .replace(/^custom[._-]?/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Custom Event'
  )
}

export function getSchedulingEventTypeDefinition(
  type: SchedulingEventType | string,
) {
  return (
    SCHEDULING_EVENT_TYPES[type as SchedulingEventType] ?? {
      key: type as SchedulingEventType,
      label: labelFromEventTypeKey(type),
      description: 'Workspace custom event type.',
      sections: ['calendar'],
      defaultDurationMinutes: 60,
      blocksAvailability: true,
    }
  )
}
