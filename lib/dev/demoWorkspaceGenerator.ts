import {
  addDateKeys,
  combineDateAndTimeInTimezone,
} from '@/lib/scheduling/schedulingDateTime'
import type {
  SchedulingEventStatus,
  SchedulingEventType,
  SchedulingLinkedRecordType,
  SchedulingLocationType,
  SchedulingRecurrenceRule,
} from '@/lib/scheduling/types'

export const DEMO_WORKSPACE_NAME = 'Skillify Mechanical Services'
export const DEMO_WORKSPACE_TIMEZONE = 'America/New_York'
export const DEMO_RECORD_NAMESPACE = 'skillify-mechanical-demo'
export const DEMO_APPOINTMENT_COUNT = 112

export type DemoScenarioPreset =
  | 'scheduling-balanced'
  | 'scheduling-overloaded'
  | 'dispatch-chaos'
  | 'clean-small-business'
  | 'service-business-growth'
  | 'automation-failure-review'
  | 'ai-playground-comprehensive'

export type DemoWorkspaceGenerationConfig = {
  preset?: DemoScenarioPreset
  seed?: number
  anchorDate?: string
  timezone?: string
  naturalLanguageDescription?: string
  businessType?: string
  workspaceSize?: 'small' | 'medium' | 'large'
  teamCount?: number
  locationCount?: number
  memberCount?: number
  schedulingContactCount?: number
  recurringSeriesCount?: number
  emergencyEventCount?: number
  availabilityRecordCount?: number
  members?: {
    count?: number
    overloadedCount?: number
    unassignedCount?: number
  }
  scheduling?: {
    eventCount?: number
    unassignedPercent?: number
    completedPercent?: number
    canceledPercent?: number
    recurringPercent?: number
    dateSpreadDays?: number
    dateRangeDistribution?: 'past-heavy' | 'balanced' | 'upcoming-heavy'
    workloadDistribution?: 'balanced' | 'overloaded' | 'chaotic'
  }
  scenarios?: Partial<
    Record<
      | 'doubleBooking'
      | 'ptoConflict'
      | 'afterHoursEmergency'
      | 'concentratedRecurringWorkload'
      | 'unassignedWork'
      | 'certificationMismatch'
      | 'locationMismatch'
      | 'longTravel'
      | 'recurringCollision'
      | 'requestedUnavailableMember'
      | 'externalCalendarBusyConflict'
      | 'cleanScenario',
      number
    >
  >
  unsupportedModules?: string[]
}

export type DemoWorkspaceOptions = {
  workspaceId: string
  anchorDate: string
  timezone?: string
  config?: DemoWorkspaceGenerationConfig
}

export type DemoTeam = {
  id: string
  name: string
  description: string
  teamType: 'FIELD_CREW' | 'SERVICE' | 'INSTALLATION' | 'OTHER'
}

export type DemoLocation = {
  id: string
  name: string
  addressLine1: string
  city: string
  region: string
  postalCode: string
}

export type DemoTechnician = {
  userId: string
  memberId: string
  fullName: string
  email: string
  phone: string
  role: 'owner' | 'admin' | 'manager' | 'member'
  teamId: string
  locationId: string
  workHours: string
  skills: string[]
  certifications: string[]
  experienceYears: number
}

export type DemoCustomer = {
  id: string
  type: 'residential' | 'commercial' | 'propertyManagement' | 'industrial'
  name: string
  company?: string
  contactName: string
  email: string
  phone: string
  address: string
  city: string
  region: string
  postalCode: string
  latitudeBucket: 'north' | 'central' | 'south'
}

export type DemoSchedulingEvent = {
  id: string
  title: string
  description: string
  type: SchedulingEventType
  status: SchedulingEventStatus
  date: string
  startTime: string
  durationMinutes: number
  timezone: string
  locationType: SchedulingLocationType
  locationLabel: string
  locationAddress: string
  assignedMemberIds: string[]
  linkedRecord: {
    recordType: SchedulingLinkedRecordType
    recordId: string
    label: string
  }
  attendees: Array<{ name: string; email: string }>
  recurrenceRule?: SchedulingRecurrenceRule
  scenarioTags: string[]
}

export type DemoAvailabilityRecord = {
  id: string
  kind: 'workingHours' | 'timeOff' | 'availabilityException'
  memberId?: string
  teamId?: string
  title: string
  startsAt?: string
  endsAt?: string
  daysOfWeek?: number[]
  startTimeMinutes?: number
  endTimeMinutes?: number
  allDay?: boolean
  category?:
    | 'VACATION'
    | 'SICK'
    | 'PERSONAL'
    | 'APPOINTMENT'
    | 'UNAVAILABLE'
    | 'OTHER'
  exceptionType?: 'CLOSED' | 'CUSTOM_HOURS'
  notes?: string
}

export type DemoWorkspacePlan = {
  workspaceId: string
  anchorDate: string
  timezone: string
  demoIdPrefix: string
  teams: DemoTeam[]
  locations: DemoLocation[]
  technicians: DemoTechnician[]
  customers: DemoCustomer[]
  events: DemoSchedulingEvent[]
  availability: DemoAvailabilityRecord[]
  intentionallyCreatedScenarios: string[]
  generationConfig: Required<
    Pick<DemoWorkspaceGenerationConfig, 'preset' | 'seed'>
  >
  unsupportedRequestedModules: string[]
}

const demoPresetDefaults: Record<
  DemoScenarioPreset,
  DemoWorkspaceGenerationConfig
> = {
  'scheduling-balanced': {
    preset: 'scheduling-balanced',
    seed: 11,
    scheduling: {
      eventCount: DEMO_APPOINTMENT_COUNT,
      unassignedPercent: 8,
      recurringPercent: 25,
    },
  },
  'scheduling-overloaded': {
    preset: 'scheduling-overloaded',
    seed: 21,
    scheduling: { eventCount: 96, unassignedPercent: 12, recurringPercent: 35 },
    scenarios: { concentratedRecurringWorkload: 2, doubleBooking: 2 },
  },
  'dispatch-chaos': {
    preset: 'dispatch-chaos',
    seed: 31,
    scheduling: {
      eventCount: 128,
      unassignedPercent: 20,
      recurringPercent: 40,
    },
    scenarios: { doubleBooking: 4, ptoConflict: 3, afterHoursEmergency: 6 },
  },
  'clean-small-business': {
    preset: 'clean-small-business',
    seed: 41,
    workspaceSize: 'small',
    scheduling: { eventCount: 24, unassignedPercent: 0, recurringPercent: 10 },
    scenarios: { cleanScenario: 1 },
  },
  'service-business-growth': {
    preset: 'service-business-growth',
    seed: 51,
    scheduling: { eventCount: 72, unassignedPercent: 10, recurringPercent: 30 },
  },
  'automation-failure-review': {
    preset: 'automation-failure-review',
    seed: 61,
    scheduling: { eventCount: 36, unassignedPercent: 8, recurringPercent: 20 },
    unsupportedModules: ['failed automation runs'],
  },
  'ai-playground-comprehensive': {
    preset: 'ai-playground-comprehensive',
    seed: 42,
    scheduling: { eventCount: 60, unassignedPercent: 15, recurringPercent: 40 },
    scenarios: {
      doubleBooking: 2,
      ptoConflict: 2,
      afterHoursEmergency: 4,
      concentratedRecurringWorkload: 1,
      unassignedWork: 2,
    },
  },
}

export function resolveDemoWorkspaceGenerationConfig(
  config: DemoWorkspaceGenerationConfig = {},
): DemoWorkspaceGenerationConfig & {
  preset: DemoScenarioPreset
  seed: number
  scheduling: NonNullable<DemoWorkspaceGenerationConfig['scheduling']>
  unsupportedModules: string[]
} {
  const preset = config.preset ?? 'scheduling-balanced'
  const presetDefaults = demoPresetDefaults[preset]
  if (!presetDefaults) {
    throw new Error(
      `Unsupported demo scenario preset: ${String(config.preset)}`,
    )
  }
  const scheduling = {
    ...presetDefaults.scheduling,
    ...config.scheduling,
  }
  const eventCount = scheduling.eventCount ?? DEMO_APPOINTMENT_COUNT
  if (!Number.isInteger(eventCount) || eventCount < 1 || eventCount > 500) {
    throw new Error(
      'Demo scheduling.eventCount must be a whole number from 1 to 500.',
    )
  }
  const seed = config.seed ?? presetDefaults.seed ?? 42
  if (!Number.isInteger(seed)) {
    throw new Error('Demo seed must be a whole number.')
  }
  for (const [label, value] of [
    ['teamCount', config.teamCount],
    ['locationCount', config.locationCount],
    ['memberCount', config.memberCount],
    ['schedulingContactCount', config.schedulingContactCount],
    ['recurringSeriesCount', config.recurringSeriesCount],
    ['emergencyEventCount', config.emergencyEventCount],
    ['availabilityRecordCount', config.availabilityRecordCount],
  ] as const) {
    if (
      value !== undefined &&
      (!Number.isInteger(value) || value < 0 || value > 500)
    ) {
      throw new Error(`Demo ${label} must be a whole number from 0 to 500.`)
    }
  }
  for (const [label, value] of [
    ['unassignedPercent', scheduling.unassignedPercent],
    ['completedPercent', scheduling.completedPercent],
    ['canceledPercent', scheduling.canceledPercent],
    ['recurringPercent', scheduling.recurringPercent],
  ] as const) {
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value < 0 || value > 100)
    ) {
      throw new Error(
        `Demo scheduling.${label} must be a percentage from 0 to 100.`,
      )
    }
  }
  return {
    ...presetDefaults,
    ...config,
    preset,
    seed,
    scheduling: {
      ...scheduling,
      eventCount,
    },
    scenarios: {
      ...presetDefaults.scenarios,
      ...config.scenarios,
    },
    unsupportedModules: [
      ...new Set([
        ...(presetDefaults.unsupportedModules ?? []),
        ...(config.unsupportedModules ?? []),
      ]),
    ],
  }
}

const firstNames = [
  'Avery',
  'Blake',
  'Cameron',
  'Devon',
  'Elliot',
  'Finley',
  'Harper',
  'Jamie',
  'Kendall',
  'Logan',
  'Marley',
  'Noel',
  'Parker',
  'Quinn',
  'Reese',
  'Riley',
  'Rowan',
  'Skyler',
  'Tatum',
  'Taylor',
]

const lastNames = [
  'Adams',
  'Bennett',
  'Coleman',
  'Diaz',
  'Edwards',
  'Foster',
  'Garcia',
  'Hayes',
  'Irwin',
  'Jordan',
  'Kim',
  'Lewis',
  'Morgan',
  'Nelson',
  'Ortiz',
  'Powell',
  'Reed',
  'Stone',
  'Turner',
  'Vargas',
]

const companyNames = [
  'Brighton Commons',
  'Cedar Ridge Apartments',
  'Summit Foods',
  'Westgate Medical Plaza',
  'Queen City Lofts',
  'Metroline Packaging',
  'Fountain View HOA',
  'Apex Auto Group',
  'Carolina Warehouse Co.',
  'Pinecrest Offices',
  'Lakeside Property Group',
  'Union Street Market',
]

const cityBands = {
  north: [
    ['Huntersville', 'NC', '28078'],
    ['Concord', 'NC', '28027'],
    ['Cornelius', 'NC', '28031'],
  ],
  central: [
    ['Charlotte', 'NC', '28202'],
    ['Matthews', 'NC', '28105'],
    ['Mint Hill', 'NC', '28227'],
  ],
  south: [
    ['Pineville', 'NC', '28134'],
    ['Fort Mill', 'SC', '29715'],
    ['Rock Hill', 'SC', '29730'],
  ],
} as const

function demoPrefix(workspaceId: string) {
  return `${DEMO_RECORD_NAMESPACE}-${workspaceId}`
}

function demoId(workspaceId: string, suffix: string) {
  return `${demoPrefix(workspaceId)}-${suffix}`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function addMinutes(time: string, minutes: number) {
  const [hours = '0', rawMinutes = '0'] = time.split(':')
  const total = Number(hours) * 60 + Number(rawMinutes) + minutes
  const nextHours = Math.floor(total / 60)
  const nextMinutes = total % 60
  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`
}

function createTeams(workspaceId: string): DemoTeam[] {
  return [
    {
      id: demoId(workspaceId, 'team-residential'),
      name: 'Residential Service',
      description: 'Home HVAC, plumbing, inspections, and warranty visits.',
      teamType: 'SERVICE',
    },
    {
      id: demoId(workspaceId, 'team-commercial'),
      name: 'Commercial Projects',
      description:
        'Commercial service, planned installations, and facilities work.',
      teamType: 'INSTALLATION',
    },
    {
      id: demoId(workspaceId, 'team-emergency'),
      name: 'Emergency Response',
      description: 'Same-day emergency dispatch and after-hours coverage.',
      teamType: 'FIELD_CREW',
    },
  ]
}

function createLocations(workspaceId: string): DemoLocation[] {
  return [
    {
      id: demoId(workspaceId, 'location-north'),
      name: 'North Branch',
      addressLine1: '11821 Statesville Rd',
      city: 'Huntersville',
      region: 'NC',
      postalCode: '28078',
    },
    {
      id: demoId(workspaceId, 'location-central'),
      name: 'Central Dispatch',
      addressLine1: '525 N Tryon St',
      city: 'Charlotte',
      region: 'NC',
      postalCode: '28202',
    },
    {
      id: demoId(workspaceId, 'location-south'),
      name: 'South Service Yard',
      addressLine1: '1027 Regent Pkwy',
      city: 'Fort Mill',
      region: 'SC',
      postalCode: '29715',
    },
  ]
}

function createTechnicians(
  workspaceId: string,
  teams: DemoTeam[],
  locations: DemoLocation[],
) {
  const teamByName = new Map(teams.map((team) => [team.name, team.id]))
  const locationByName = new Map(
    locations.map((location) => [location.name, location.id]),
  )
  const technicians = [
    [
      'Alex Rivera',
      'alex.rivera',
      'Residential Service',
      'North Branch',
      'manager',
      '7:00 AM-4:00 PM',
      ['HVAC diagnostics', 'heat pumps', 'smart thermostats'],
      ['EPA 608', 'NATE'],
      11,
    ],
    [
      'Sarah Davis',
      'sarah.davis',
      'Commercial Projects',
      'Central Dispatch',
      'manager',
      '8:00 AM-5:00 PM',
      ['commercial HVAC', 'backflow', 'boilers'],
      ['Backflow Tester', 'EPA 608'],
      9,
    ],
    [
      'Mike Johnson',
      'mike.johnson',
      'Residential Service',
      'South Service Yard',
      'member',
      '9:00 AM-5:00 PM',
      ['electrical troubleshooting', 'panel safety', 'water heaters'],
      ['Journeyman Electrician'],
      5,
    ],
    [
      'Emily Wilson',
      'emily.wilson',
      'Residential Service',
      'North Branch',
      'member',
      '8:00 AM-4:00 PM',
      ['maintenance', 'indoor air quality', 'warranty'],
      ['EPA 608'],
      6,
    ],
    [
      'Chris Miller',
      'chris.miller',
      'Commercial Projects',
      'Central Dispatch',
      'member',
      '7:30 AM-4:30 PM',
      ['installations', 'rooftop units', 'controls'],
      ['NATE', 'OSHA 30'],
      8,
    ],
    [
      'Priya Patel',
      'priya.patel',
      'Commercial Projects',
      'Central Dispatch',
      'member',
      '8:00 AM-5:00 PM',
      ['preventive maintenance', 'chillers', 'tenant improvements'],
      ['EPA 608 Universal'],
      10,
    ],
    [
      'Jordan Lee',
      'jordan.lee',
      'Emergency Response',
      'South Service Yard',
      'manager',
      '10:00 AM-7:00 PM',
      ['emergency plumbing', 'leaks', 'after-hours dispatch'],
      ['Master Plumber'],
      12,
    ],
    [
      'Morgan Brooks',
      'morgan.brooks',
      'Residential Service',
      'South Service Yard',
      'member',
      '8:00 AM-5:00 PM',
      ['drain cleaning', 'mini-splits', 'maintenance'],
      ['EPA 608'],
      4,
    ],
    [
      'Taylor Nguyen',
      'taylor.nguyen',
      'Commercial Projects',
      'North Branch',
      'member',
      '8:00 AM-5:00 PM',
      ['apprentice support', 'filters', 'site prep'],
      ['Apprentice HVAC'],
      2,
    ],
    [
      'Dana Kim',
      'dana.kim',
      'Emergency Response',
      'Central Dispatch',
      'admin',
      '7:00 AM-6:00 PM',
      ['dispatch leadership', 'quality review', 'escalations'],
      ['EPA 608', 'OSHA 30'],
      14,
    ],
  ] as const

  return technicians.map((item) => {
    const [
      fullName,
      emailSlug,
      teamName,
      locationName,
      role,
      workHours,
      skills,
      certifications,
      experienceYears,
    ] = item
    return {
      userId: demoId(workspaceId, `user-${slugify(fullName)}`),
      memberId: demoId(workspaceId, `member-${slugify(fullName)}`),
      fullName,
      email: `${emailSlug}@demo.skillify.dev`,
      phone: `704-555-${String(1000 + slugify(fullName).length * 137).slice(0, 4)}`,
      role,
      teamId: teamByName.get(teamName) ?? teams[0].id,
      locationId: locationByName.get(locationName) ?? locations[0].id,
      workHours,
      skills: [...skills],
      certifications: [...certifications],
      experienceYears,
    } satisfies DemoTechnician
  })
}

function createCustomers(workspaceId: string): DemoCustomer[] {
  return Array.from({ length: 54 }, (_, index) => {
    const type = (
      ['residential', 'commercial', 'propertyManagement', 'industrial'] as const
    )[index % 4]
    const band = (['north', 'central', 'south'] as const)[index % 3]
    const [city, region, postalCode] =
      cityBands[band][index % cityBands[band].length]
    const firstName = firstNames[index % firstNames.length]
    const lastName = lastNames[(index * 3) % lastNames.length]
    const company =
      type === 'residential'
        ? undefined
        : companyNames[index % companyNames.length]
    const contactName = `${firstName} ${lastName}`
    const name = company ?? `${contactName} Residence`
    return {
      id: demoId(workspaceId, `customer-${String(index + 1).padStart(3, '0')}`),
      type,
      name,
      company,
      contactName,
      email: `${slugify(contactName)}.${index + 1}@example-customer.test`,
      phone: `704-555-${String(2100 + index).padStart(4, '0')}`,
      address: `${1200 + index * 17} ${['Oak', 'Tryon', 'Trade', 'Cedar', 'Park'][index % 5]} ${['St', 'Ave', 'Rd', 'Blvd'][index % 4]}`,
      city,
      region,
      postalCode,
      latitudeBucket: band,
    }
  })
}

const eventTemplates = [
  { type: 'scheduledJob', title: 'HVAC diagnostic', duration: 90 },
  { type: 'scheduledJob', title: 'Water heater repair', duration: 120 },
  {
    type: 'recurringServiceVisit',
    title: 'Quarterly maintenance visit',
    duration: 75,
  },
  { type: 'scheduledJob', title: 'Electrical safety inspection', duration: 60 },
  { type: 'discoveryCall', title: 'Replacement estimate', duration: 45 },
  { type: 'scheduledJob', title: 'Rooftop unit service', duration: 150 },
  { type: 'internalMeeting', title: 'Dispatch standup', duration: 30 },
] as const

function createEvents({
  workspaceId,
  anchorDate,
  timezone,
  technicians,
  customers,
  config,
}: {
  workspaceId: string
  anchorDate: string
  timezone: string
  technicians: DemoTechnician[]
  customers: DemoCustomer[]
  config: ReturnType<typeof resolveDemoWorkspaceGenerationConfig>
}) {
  const alex =
    technicians.find((tech) => tech.fullName === 'Alex Rivera') ??
    technicians[0]
  const emily =
    technicians.find((tech) => tech.fullName === 'Emily Wilson') ??
    technicians[3]
  const jordan =
    technicians.find((tech) => tech.fullName === 'Jordan Lee') ?? technicians[6]
  const taylor =
    technicians.find((tech) => tech.fullName === 'Taylor Nguyen') ??
    technicians[8]
  const mike =
    technicians.find((tech) => tech.fullName === 'Mike Johnson') ??
    technicians[2]
  const priya =
    technicians.find((tech) => tech.fullName === 'Priya Patel') ??
    technicians[5]
  let recurringServiceIndex = 0

  const eventCount = config.scheduling.eventCount ?? DEMO_APPOINTMENT_COUNT
  return Array.from({ length: eventCount }, (_, index) => {
    const dayOffset = (index % 15) - 7
    const date = addDateKeys(anchorDate, dayOffset)
    const customer = customers[index % customers.length]
    const template = eventTemplates[index % eventTemplates.length]
    const startHour = 8 + ((index * 2) % 9)
    const startMinute = index % 3 === 0 ? '00' : index % 3 === 1 ? '30' : '15'
    let startTime = `${String(startHour).padStart(2, '0')}:${startMinute}`
    let assignedMemberIds = [technicians[index % technicians.length].memberId]
    const scenarioTags: string[] = []
    let title = `${template.title} - ${customer.name}`
    let status: SchedulingEventStatus =
      dayOffset < -1
        ? index % 11 === 0
          ? 'canceled'
          : 'completed'
        : dayOffset === 0 && index % 17 === 0
          ? 'inProgress'
          : index % 19 === 0
            ? 'missed'
            : index % 3 === 0
              ? 'confirmed'
              : 'scheduled'

    if (index >= 12 && index < 20) {
      assignedMemberIds = [alex.memberId]
      startTime = `${String(9 + (index % 4)).padStart(2, '0')}:00`
      scenarioTags.push('overloaded-technician')
    }
    if (index === 18 || index === 19) {
      assignedMemberIds = [alex.memberId]
      startTime = '10:00'
      scenarioTags.push('double-booking')
    }
    if (index === 24) {
      assignedMemberIds = [emily.memberId]
      startTime = '11:00'
      title = `PTO conflict - ${customer.name}`
      scenarioTags.push('pto-conflict')
    }
    if (index === 31 || index === 63 || index === 97) {
      assignedMemberIds = []
      title = `Unassigned ${template.title.toLowerCase()} - ${customer.name}`
      scenarioTags.push('unassigned-work')
    }
    if (index >= 40 && index < 48) {
      assignedMemberIds = [jordan.memberId]
      startTime = index % 2 === 0 ? '18:30' : '21:15'
      title = `After-hours emergency - ${customer.name}`
      status = 'confirmed'
      scenarioTags.push('after-hours-emergency')
    }
    if (index === 58) {
      assignedMemberIds = [taylor.memberId]
      title = `Certification mismatch - boiler service at ${customer.name}`
      scenarioTags.push('certification-mismatch')
    }
    if (index === 73) {
      assignedMemberIds = [mike.memberId]
      title = `North-to-south route mismatch - ${customer.name}`
      scenarioTags.push('location-mismatch', 'long-travel')
    }
    if (index === 84) {
      assignedMemberIds = [priya.memberId]
      title = `Recurring service collision - ${customer.name}`
      scenarioTags.push('recurring-collision')
    }
    if (index === 91) {
      assignedMemberIds = [emily.memberId]
      title = `Customer requested unavailable technician - ${customer.name}`
      scenarioTags.push('customer-requested-unavailable-tech')
    }

    const eventType = template.type as SchedulingEventType
    const linkedRecordType: SchedulingLinkedRecordType =
      eventType === 'discoveryCall'
        ? 'lead'
        : customer.type === 'residential'
          ? 'client'
          : 'serviceRequest'
    const recurrenceIndex =
      eventType === 'recurringServiceVisit' ? recurringServiceIndex++ : -1
    const recurrenceRule =
      recurrenceIndex >= 0 && recurrenceIndex < 4
        ? ({
            frequency:
              recurrenceIndex === 3
                ? 'yearly'
                : recurrenceIndex === 0
                  ? 'weekly'
                  : 'monthly',
            interval: recurrenceIndex === 2 ? 3 : 1,
            daysOfWeek: recurrenceIndex === 0 ? [1 + (index % 5)] : undefined,
            endType: 'afterOccurrences',
            occurrenceCount: recurrenceIndex === 0 ? 8 : 6,
          } satisfies SchedulingRecurrenceRule)
        : undefined

    return {
      id: demoId(workspaceId, `event-${String(index + 1).padStart(3, '0')}`),
      title,
      description: [
        `Generated development demo appointment for ${DEMO_WORKSPACE_NAME}.`,
        `Customer type: ${customer.type}.`,
        scenarioTags.length ? `Scenario: ${scenarioTags.join(', ')}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
      type: eventType,
      status,
      date,
      startTime,
      durationMinutes: template.duration,
      timezone,
      locationType:
        eventType === 'internalMeeting' ? 'none' : 'customerLocation',
      locationLabel:
        eventType === 'internalMeeting' ? 'Central Dispatch' : customer.name,
      locationAddress: `${customer.address}, ${customer.city}, ${customer.region} ${customer.postalCode}`,
      assignedMemberIds,
      linkedRecord: {
        recordType: linkedRecordType,
        recordId: `${customer.id}-work-${String(index + 1).padStart(3, '0')}`,
        label: `${linkedRecordType === 'lead' ? 'Estimate' : 'Service'} - ${customer.name}`,
      },
      attendees: [{ name: customer.contactName, email: customer.email }],
      recurrenceRule,
      scenarioTags,
    } satisfies DemoSchedulingEvent
  })
}

function createAvailability({
  workspaceId,
  anchorDate,
  timezone,
  technicians,
  teams,
}: {
  workspaceId: string
  anchorDate: string
  timezone: string
  technicians: DemoTechnician[]
  teams: DemoTeam[]
}) {
  const emily =
    technicians.find((tech) => tech.fullName === 'Emily Wilson') ??
    technicians[3]
  const chris =
    technicians.find((tech) => tech.fullName === 'Chris Miller') ??
    technicians[4]
  const sarah =
    technicians.find((tech) => tech.fullName === 'Sarah Davis') ??
    technicians[1]
  const jordan =
    technicians.find((tech) => tech.fullName === 'Jordan Lee') ?? technicians[6]
  const emergencyTeam =
    teams.find((team) => team.name === 'Emergency Response') ?? teams[2]

  const records: DemoAvailabilityRecord[] = technicians.map((tech) => ({
    id: demoId(
      workspaceId,
      `availability-working-hours-${slugify(tech.fullName)}`,
    ),
    kind: 'workingHours',
    memberId: tech.memberId,
    title: `${tech.fullName} working hours`,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTimeMinutes: tech.fullName === 'Jordan Lee' ? 600 : 480,
    endTimeMinutes: tech.fullName === 'Jordan Lee' ? 1140 : 1020,
    notes: `${tech.workHours}. Skills: ${tech.skills.join(', ')}.`,
  }))

  records.push(
    {
      id: demoId(workspaceId, 'availability-time-off-emily-pto'),
      kind: 'timeOff',
      memberId: emily.memberId,
      title: 'Vacation PTO',
      startsAt: combineDateAndTimeInTimezone({
        dateKey: anchorDate,
        time: '00:00',
        timezone,
      }).toISOString(),
      endsAt: combineDateAndTimeInTimezone({
        dateKey: addDateKeys(anchorDate, 1),
        time: '00:00',
        timezone,
      }).toISOString(),
      allDay: true,
      category: 'VACATION',
      notes: 'Intentional PTO conflict with a customer-requested appointment.',
    },
    {
      id: demoId(workspaceId, 'availability-time-off-chris-training'),
      kind: 'timeOff',
      memberId: chris.memberId,
      title: 'Manufacturer training',
      startsAt: combineDateAndTimeInTimezone({
        dateKey: addDateKeys(anchorDate, 1),
        time: '08:00',
        timezone,
      }).toISOString(),
      endsAt: combineDateAndTimeInTimezone({
        dateKey: addDateKeys(anchorDate, 1),
        time: '13:00',
        timezone,
      }).toISOString(),
      allDay: false,
      category: 'OTHER',
      notes: 'Training day blocks commercial installation coverage.',
    },
    {
      id: demoId(workspaceId, 'availability-time-off-sarah-sick-day'),
      kind: 'timeOff',
      memberId: sarah.memberId,
      title: 'Sick day',
      startsAt: combineDateAndTimeInTimezone({
        dateKey: addDateKeys(anchorDate, -2),
        time: '00:00',
        timezone,
      }).toISOString(),
      endsAt: combineDateAndTimeInTimezone({
        dateKey: addDateKeys(anchorDate, -1),
        time: '00:00',
        timezone,
      }).toISOString(),
      allDay: true,
      category: 'SICK',
      notes: 'Recent sick day for historical availability context.',
    },
    {
      id: demoId(workspaceId, 'availability-time-off-jordan-external-busy'),
      kind: 'timeOff',
      memberId: jordan.memberId,
      title: 'External calendar busy - school pickup',
      startsAt: combineDateAndTimeInTimezone({
        dateKey: addDateKeys(anchorDate, 2),
        time: '15:00',
        timezone,
      }).toISOString(),
      endsAt: combineDateAndTimeInTimezone({
        dateKey: addDateKeys(anchorDate, 2),
        time: '16:00',
        timezone,
      }).toISOString(),
      allDay: false,
      category: 'UNAVAILABLE',
      notes: 'Represents an external personal calendar busy block.',
    },
    {
      id: demoId(workspaceId, 'availability-exception-sunday-closure'),
      kind: 'availabilityException',
      teamId: emergencyTeam.id,
      title: 'Emergency team short-staffed Sunday',
      startsAt: combineDateAndTimeInTimezone({
        dateKey: addDateKeys(anchorDate, 3),
        time: '00:00',
        timezone,
      }).toISOString(),
      endsAt: combineDateAndTimeInTimezone({
        dateKey: addDateKeys(anchorDate, 4),
        time: '00:00',
        timezone,
      }).toISOString(),
      allDay: true,
      exceptionType: 'CLOSED',
      notes: 'Intentional recurring-coverage pressure point for AI scheduling.',
    },
  )

  return records
}

export function createDemoWorkspacePlan({
  workspaceId,
  anchorDate,
  timezone = DEMO_WORKSPACE_TIMEZONE,
  config,
}: DemoWorkspaceOptions): DemoWorkspacePlan {
  const resolvedConfig = resolveDemoWorkspaceGenerationConfig(config)
  const teams = createTeams(workspaceId)
  const locations = createLocations(workspaceId)
  const technicians = createTechnicians(workspaceId, teams, locations)
  const customers = createCustomers(workspaceId)
  const events = createEvents({
    workspaceId,
    anchorDate,
    timezone,
    technicians,
    customers,
    config: resolvedConfig,
  })
  const availability = createAvailability({
    workspaceId,
    anchorDate,
    timezone,
    technicians,
    teams,
  })

  return {
    workspaceId,
    anchorDate,
    timezone,
    demoIdPrefix: demoPrefix(workspaceId),
    teams,
    locations,
    technicians,
    customers,
    events,
    availability,
    intentionallyCreatedScenarios: [
      'overloaded-technician',
      'double-booking',
      'pto-conflict',
      'after-hours-emergency',
      'unassigned-work',
      'certification-mismatch',
      'location-mismatch',
      'long-travel',
      'recurring-collision',
      'customer-requested-unavailable-tech',
      'external-calendar-busy',
    ],
    generationConfig: {
      preset: resolvedConfig.preset,
      seed: resolvedConfig.seed,
    },
    unsupportedRequestedModules: resolvedConfig.unsupportedModules,
  }
}

export function getDemoWorkspaceSummary(plan: DemoWorkspacePlan) {
  const scenarioCounts = new Map<string, number>()
  for (const event of plan.events) {
    for (const tag of event.scenarioTags) {
      scenarioCounts.set(tag, (scenarioCounts.get(tag) ?? 0) + 1)
    }
  }
  return {
    workspaceId: plan.workspaceId,
    anchorDate: plan.anchorDate,
    timezone: plan.timezone,
    teams: plan.teams.length,
    locations: plan.locations.length,
    technicians: plan.technicians.length,
    schedulingContacts: plan.customers.length,
    crmClients: 0,
    customers: plan.customers.length,
    appointments: plan.events.length,
    availabilityRecords: plan.availability.length,
    recurringMasters: plan.events.filter((event) => event.recurrenceRule)
      .length,
    emergencyCalls: plan.events.filter((event) =>
      event.scenarioTags.includes('after-hours-emergency'),
    ).length,
    scenarioCounts: Object.fromEntries(scenarioCounts.entries()),
    preset: plan.generationConfig.preset,
    seed: plan.generationConfig.seed,
    unsupportedRequestedModules: plan.unsupportedRequestedModules,
    dateRange: {
      start:
        plan.events.map((event) => event.date).sort()[0] ?? plan.anchorDate,
      end:
        plan.events
          .map((event) => event.date)
          .sort()
          .at(-1) ?? plan.anchorDate,
    },
  }
}

export function assertDemoWorkspaceGeneratorAllowed(env = process.env) {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'The development demo workspace generator is disabled in production.',
    )
  }
}

export async function resetDemoWorkspaceRecords(workspaceId: string) {
  const { prisma } = await import('@/lib/db')
  const prefix = demoPrefix(workspaceId)
  const demoEvents = await prisma.schedulingEvent.findMany({
    where: {
      workspaceId,
      OR: [
        { id: { startsWith: prefix } },
        { linkedRecordId: { startsWith: prefix } },
      ],
    },
    select: { id: true },
  })
  const demoSeries = await prisma.schedulingRecurrenceSeries.findMany({
    where: {
      workspaceId,
      OR: [
        { masterEventId: { in: demoEvents.map((event) => event.id) } },
        {
          metadata: { path: ['demoNamespace'], equals: DEMO_RECORD_NAMESPACE },
        },
      ],
    },
    select: { id: true },
  })
  const seriesIds = demoSeries.map((series) => series.id)
  const seriesEvents = seriesIds.length
    ? await prisma.schedulingEvent.findMany({
        where: { workspaceId, recurrenceSeriesId: { in: seriesIds } },
        select: { id: true },
      })
    : []
  const eventIds = Array.from(
    new Set([
      ...demoEvents.map((event) => event.id),
      ...seriesEvents.map((event) => event.id),
    ]),
  )
  const counts = {
    events: eventIds.length,
    recurrenceSeries: seriesIds.length,
    notifications: 0,
    attendees: 0,
    assignments: 0,
    activity: 0,
    outboxEvents: 0,
    availabilityRecords: 0,
    providerMappings: 0,
    syncConflicts: 0,
    teamMembers: 0,
    teams: 0,
    locations: 0,
    workspaceMembers: 0,
    userProfiles: 0,
  }

  if (eventIds.length) {
    counts.notifications = (
      await prisma.schedulingNotificationDelivery.deleteMany({
        where: { workspaceId, schedulingEventId: { in: eventIds } },
      })
    ).count
    counts.attendees = (
      await prisma.schedulingAttendee.deleteMany({
        where: { workspaceId, eventId: { in: eventIds } },
      })
    ).count
    counts.assignments = (
      await prisma.schedulingAssignment.deleteMany({
        where: { workspaceId, eventId: { in: eventIds } },
      })
    ).count
    counts.activity = (
      await prisma.schedulingEventActivity.deleteMany({
        where: { workspaceId, eventId: { in: eventIds } },
      })
    ).count
    counts.syncConflicts = (
      await prisma.calendarSyncConflict.deleteMany({
        where: { workspaceId, schedulingEventId: { in: eventIds } },
      })
    ).count
    counts.providerMappings = (
      await prisma.calendarEventMapping.deleteMany({
        where: { workspaceId, schedulingEventId: { in: eventIds } },
      })
    ).count
    counts.outboxEvents += (
      await prisma.domainOutboxEvent.deleteMany({
        where: { workspaceId, aggregateId: { in: eventIds } },
      })
    ).count
    await prisma.schedulingEvent.updateMany({
      where: { workspaceId, id: { in: eventIds } },
      data: { recurrenceSeriesId: null },
    })
  }
  if (seriesIds.length) {
    counts.outboxEvents += (
      await prisma.domainOutboxEvent.deleteMany({
        where: { workspaceId, aggregateId: { in: seriesIds } },
      })
    ).count
    counts.recurrenceSeries = (
      await prisma.schedulingRecurrenceSeries.deleteMany({
        where: { workspaceId, id: { in: seriesIds } },
      })
    ).count
  }
  if (eventIds.length) {
    counts.events = (
      await prisma.schedulingEvent.deleteMany({
        where: { workspaceId, id: { in: eventIds } },
      })
    ).count
  }

  counts.availabilityRecords = (
    await prisma.schedulingAvailabilityRecord.deleteMany({
      where: { workspaceId, id: { startsWith: prefix } },
    })
  ).count
  counts.teamMembers = (
    await prisma.workspaceTeamMember.deleteMany({
      where: {
        workspaceId,
        OR: [
          { teamId: { startsWith: prefix } },
          { workspaceMemberId: { startsWith: prefix } },
        ],
      },
    })
  ).count
  counts.teams = (
    await prisma.workspaceTeam.deleteMany({
      where: { workspaceId, id: { startsWith: prefix } },
    })
  ).count
  counts.locations = (
    await prisma.workspaceLocation.deleteMany({
      where: { workspaceId, id: { startsWith: prefix } },
    })
  ).count
  counts.workspaceMembers = (
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId, id: { startsWith: prefix } },
    })
  ).count
  counts.userProfiles = (
    await prisma.userProfile.deleteMany({
      where: {
        clerkId: { startsWith: `${DEMO_RECORD_NAMESPACE}:${workspaceId}:` },
      },
    })
  ).count
  return counts
}

export async function getStoredDemoWorkspaceSummary(workspaceId: string) {
  const { prisma } = await import('@/lib/db')
  const prefix = demoPrefix(workspaceId)
  const [
    teams,
    locations,
    technicians,
    appointments,
    availabilityRecords,
    recurrenceSeries,
  ] = await Promise.all([
    prisma.workspaceTeam.count({
      where: { workspaceId, id: { startsWith: prefix } },
    }),
    prisma.workspaceLocation.count({
      where: { workspaceId, id: { startsWith: prefix } },
    }),
    prisma.workspaceMember.count({
      where: { workspaceId, id: { startsWith: prefix } },
    }),
    prisma.schedulingEvent.count({
      where: {
        workspaceId,
        id: { startsWith: prefix },
        deletedAt: null,
      },
    }),
    prisma.schedulingAvailabilityRecord.count({
      where: { workspaceId, id: { startsWith: prefix } },
    }),
    prisma.schedulingRecurrenceSeries.count({
      where: {
        workspaceId,
        masterEvent: { id: { startsWith: prefix } },
      },
    }),
  ])

  return {
    exists:
      teams > 0 ||
      locations > 0 ||
      technicians > 0 ||
      appointments > 0 ||
      availabilityRecords > 0,
    businessName: DEMO_WORKSPACE_NAME,
    teams,
    locations,
    technicians,
    schedulingContacts: technicians > 0 || appointments > 0 ? 54 : 0,
    crmClients: 0,
    customers: technicians > 0 || appointments > 0 ? 54 : 0,
    appointments,
    availabilityRecords,
    recurringMasters: recurrenceSeries,
  }
}

export async function populateDemoWorkspace({
  workspaceId,
  anchorDate,
  timezone = DEMO_WORKSPACE_TIMEZONE,
  actorUserId,
  config,
}: DemoWorkspaceOptions & { actorUserId?: string }) {
  assertDemoWorkspaceGeneratorAllowed()
  const { prisma } = await import('@/lib/db')
  const { schedulingRepository } = await import('@/lib/scheduling/repository')
  const plan = createDemoWorkspacePlan({
    workspaceId,
    anchorDate,
    timezone,
    config,
  })
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true },
  })
  if (!workspace) throw new Error(`Workspace ${workspaceId} was not found.`)

  await resetDemoWorkspaceRecords(workspaceId)
  const actor = actorUserId ?? plan.technicians[0].userId

  for (const tech of plan.technicians) {
    await prisma.userProfile.create({
      data: {
        id: tech.userId,
        clerkId: `${DEMO_RECORD_NAMESPACE}:${workspaceId}:${tech.memberId}`,
        fullName: tech.fullName,
        email: tech.email,
        role: 'user',
      },
    })
    await prisma.workspaceMember.create({
      data: {
        id: tech.memberId,
        workspaceId,
        userId: tech.userId,
        role:
          tech.role === 'owner'
            ? 'OWNER'
            : tech.role === 'admin' || tech.role === 'manager'
              ? 'ADMIN'
              : 'MEMBER',
      },
    })
  }

  for (const location of plan.locations) {
    await prisma.workspaceLocation.create({
      data: {
        id: location.id,
        workspaceId,
        name: location.name,
        locationType: 'OFFICE',
        addressLine1: location.addressLine1,
        city: location.city,
        region: location.region,
        postalCode: location.postalCode,
        countryCode: 'US',
        timezone,
        isPrimary: location.name === 'Central Dispatch',
        createdById: actor,
      },
    })
  }

  for (const team of plan.teams) {
    const lead = plan.technicians.find((tech) => tech.teamId === team.id)
    await prisma.workspaceTeam.create({
      data: {
        id: team.id,
        workspaceId,
        name: team.name,
        description: team.description,
        teamType: team.teamType,
        leadMemberId: lead?.memberId,
        createdById: actor,
      },
    })
    for (const tech of plan.technicians.filter(
      (item) => item.teamId === team.id,
    )) {
      await prisma.workspaceTeamMember.create({
        data: {
          id: demoId(
            workspaceId,
            `team-member-${slugify(team.name)}-${slugify(tech.fullName)}`,
          ),
          workspaceId,
          teamId: team.id,
          workspaceMemberId: tech.memberId,
          roleLabel: tech.role === 'manager' ? 'Team Lead' : 'Technician',
        },
      })
    }
  }

  for (const availability of plan.availability) {
    await prisma.schedulingAvailabilityRecord.create({
      data: {
        id: availability.id,
        workspaceId,
        kind:
          availability.kind === 'workingHours'
            ? 'WORKING_HOURS'
            : availability.kind === 'timeOff'
              ? 'TIME_OFF'
              : 'AVAILABILITY_EXCEPTION',
        memberId: availability.memberId,
        teamId: availability.teamId,
        title: availability.title,
        category: availability.category,
        exceptionType: availability.exceptionType,
        startsAtUtc: availability.startsAt
          ? new Date(availability.startsAt)
          : null,
        endsAtUtc: availability.endsAt ? new Date(availability.endsAt) : null,
        timezone,
        allDay: availability.allDay ?? false,
        daysOfWeek: availability.daysOfWeek ?? [],
        startTimeMinutes: availability.startTimeMinutes,
        endTimeMinutes: availability.endTimeMinutes,
        notes: availability.notes,
        createdByUserId: actor,
      },
    })
  }

  for (const event of plan.events) {
    const startsAt = combineDateAndTimeInTimezone({
      dateKey: event.date,
      time: event.startTime,
      timezone,
    }).toISOString()
    const endsAt = combineDateAndTimeInTimezone({
      dateKey: event.date,
      time: addMinutes(event.startTime, event.durationMinutes),
      timezone,
    }).toISOString()
    await schedulingRepository.createEvent({
      workspaceId,
      actorUserId: actor,
      input: {
        id: event.id,
        title: event.title,
        description: event.description,
        type: event.type,
        status: event.status,
        startsAt,
        endsAt,
        allDay: false,
        timezone,
        locationType: event.locationType,
        locationLabel: event.locationLabel,
        locationAddress: event.locationAddress,
        assignedMemberIds: event.assignedMemberIds,
        linkedRecord: event.linkedRecord,
        recurrenceRule: event.recurrenceRule,
        attendees: event.attendees.map((attendee) => ({
          attendeeType: 'externalGuest',
          name: attendee.name,
          email: attendee.email,
          responseStatus: 'needsAction',
          isOrganizer: false,
          isOptional: false,
        })),
      },
    })
  }

  return {
    plan,
    summary: getDemoWorkspaceSummary(plan),
  }
}
