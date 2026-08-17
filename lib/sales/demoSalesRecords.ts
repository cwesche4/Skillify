import { getDemoOwnerIdByName } from '@/lib/workspace-ownership'

export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Nurture'
  | 'Disqualified'
  | 'Converted'

export type LeadStage =
  | 'New'
  | 'New Lead'
  | 'Contacted'
  | 'Estimate / Visit'
  | 'Follow-Up'
  | 'Qualified'
  | 'Nurture'
  | 'Won'
  | 'Disqualified'
  | 'Converted'
  | 'Lost'

export type LeadSource =
  | 'Website Form'
  | 'Referral'
  | 'Google Search'
  | 'Facebook/Instagram'
  | 'Manual Entry'

export type LeadRecord = {
  id: string
  name: string
  company: string
  sharedContactId?: string
  contactEmail?: string
  contactPhone?: string
  status: LeadStatus
  stage: LeadStage
  source: LeadSource
  value: number
  nextStep: string
  ownerId: string
  createdAt: string
  convertedAt?: string
  convertedDestination?: 'OPPORTUNITY' | 'SALE' | 'CUSTOMER'
  connectedRecordId?: string
  connectedRecordType?: 'Opportunity' | 'Sale' | 'Customer' | 'Client'
  lastActivityAt?: string
  followUpDue?: string
  converted: boolean
  qualificationDays?: number
  leadNotes?: string
  notes: string
}

export type OpportunityStatus =
  | 'Active'
  | 'At Risk'
  | 'Closed-Won'
  | 'Closed-Lost'

export type OpportunityStage =
  | 'Qualified'
  | 'Discovery'
  | 'Needs Analysis'
  | 'Site Visit'
  | 'Scoping'
  | 'Proposal Preparation'
  | 'Discovery Scheduled'
  | 'Proposal Sent'
  | 'Negotiation'
  | 'Won'
  | 'Lost'

export type OpportunityRecord = {
  id: string
  name: string
  client: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  company?: string
  clientId?: string
  leadId?: string
  sourceLeadId?: string
  saleId?: string
  sharedContactId?: string
  status: OpportunityStatus
  riskReason?: string
  stage: OpportunityStage
  value: number
  probability: number
  expectedRevenue?: number
  ownerId: string
  nextStep: string
  lastActivityAt: string
  createdAt?: string
  convertedAt?: string
  expectedCloseDate?: string
  opportunityNotes?: string
  notes?: string
}

export const demoSalesToday = '2026-06-29'
export const demoLeadStaleActivityCutoff = '2026-06-21'

export const demoLeads: LeadRecord[] = [
  {
    id: 'lead-rachel-adams',
    name: 'Rachel Adams',
    company: 'Adams Bookkeeping',
    status: 'New',
    stage: 'New Lead',
    source: 'Website Form',
    value: 1200,
    nextStep: 'Send qualification questions',
    ownerId: getDemoOwnerIdByName('Ops Team'),
    createdAt: '2026-06-27',
    followUpDue: demoSalesToday,
    converted: false,
    notes: 'Interested in client onboarding automation.',
  },
  {
    id: 'lead-marcus-hill',
    name: 'Marcus Hill',
    company: 'Hill Home Services',
    status: 'Contacted',
    stage: 'Contacted',
    source: 'Referral',
    value: 2800,
    nextStep: 'Book discovery call',
    ownerId: getDemoOwnerIdByName('Corbin'),
    createdAt: '2026-06-21',
    lastActivityAt: '2026-06-21',
    followUpDue: '2026-06-28',
    converted: false,
    notes: 'Referral from an existing service client.',
  },
  {
    id: 'lead-elena-cruz',
    name: 'Elena Cruz',
    company: 'Cruz Creative Studio',
    status: 'Qualified',
    stage: 'Converted',
    source: 'Google Search',
    value: 3500,
    nextStep: 'Create opportunity',
    ownerId: getDemoOwnerIdByName('Skillify AI'),
    createdAt: '2026-06-10',
    lastActivityAt: '2026-06-26',
    converted: true,
    qualificationDays: 4,
    notes: 'Qualified for website and workflow package.',
  },
  {
    id: 'lead-damon-lee',
    name: 'Damon Lee',
    company: 'Lee Family Dental',
    status: 'Nurture',
    stage: 'Nurture',
    source: 'Facebook/Instagram',
    value: 5200,
    nextStep: 'Send case study next month',
    ownerId: getDemoOwnerIdByName('Ops Team'),
    createdAt: '2026-05-31',
    lastActivityAt: '2026-06-12',
    converted: false,
    notes: 'Interested, but not ready until Q3.',
  },
  {
    id: 'lead-priya-shah',
    name: 'Priya Shah',
    company: 'Shah Wellness',
    status: 'Contacted',
    stage: 'Contacted',
    source: 'Manual Entry',
    value: 4100,
    nextStep: 'Follow up on intake needs',
    ownerId: getDemoOwnerIdByName('Corbin'),
    createdAt: '2026-06-03',
    lastActivityAt: '2026-06-17',
    followUpDue: '2026-06-24',
    converted: false,
    notes: 'Needs portal and appointment workflow support.',
  },
  {
    id: 'lead-kendra-moss',
    name: 'Kendra Moss',
    company: 'Moss Cleaning Co.',
    status: 'Disqualified',
    stage: 'Lost',
    source: 'Website Form',
    value: 900,
    nextStep: 'Archive lead',
    ownerId: getDemoOwnerIdByName('Skillify AI'),
    createdAt: '2026-06-06',
    lastActivityAt: '2026-06-08',
    converted: false,
    notes: 'Not a fit for current service scope.',
  },
]

export const demoOpportunities: OpportunityRecord[] = [
  {
    id: 'opp-northstar',
    name: 'Operations Automation Package',
    client: 'NorthStar Electrical',
    status: 'Active',
    stage: 'Proposal Sent',
    value: 6400,
    probability: 70,
    ownerId: getDemoOwnerIdByName('Corbin'),
    nextStep: 'Review proposal feedback',
    lastActivityAt: '2026-06-27',
  },
  {
    id: 'opp-luna',
    name: 'Website and Client Portal',
    client: 'Luna Wellness',
    status: 'Active',
    stage: 'Negotiation',
    value: 8200,
    probability: 65,
    ownerId: getDemoOwnerIdByName('Ops Team'),
    nextStep: 'Finalize implementation scope',
    lastActivityAt: '2026-06-25',
  },
  {
    id: 'opp-metro',
    name: 'Review Automation Rollout',
    client: 'Metro Cleaning Group',
    status: 'At Risk',
    riskReason: 'Needs follow-up',
    stage: 'Discovery Scheduled',
    value: 3900,
    probability: 45,
    ownerId: getDemoOwnerIdByName('Skillify AI'),
    nextStep: 'Send discovery recap',
    lastActivityAt: '2026-06-19',
  },
  {
    id: 'opp-carter',
    name: 'Automation Reliability Review',
    client: 'Carter Plumbing',
    status: 'At Risk',
    riskReason: 'Client delay',
    stage: 'Negotiation',
    value: 11200,
    probability: 55,
    ownerId: getDemoOwnerIdByName('Corbin'),
    nextStep: 'Resolve scope questions',
    lastActivityAt: '2026-06-20',
  },
  {
    id: 'opp-brooks',
    name: 'Review Growth Campaign',
    client: 'Brooks Cleaning Co.',
    status: 'Closed-Won',
    stage: 'Won',
    value: 3900,
    probability: 100,
    ownerId: getDemoOwnerIdByName('Skillify AI'),
    nextStep: 'Start onboarding workflow',
    lastActivityAt: '2026-06-28',
  },
  {
    id: 'opp-reed',
    name: 'Client Portal Upgrade',
    client: 'Reed HVAC',
    status: 'Closed-Lost',
    stage: 'Lost',
    value: 2400,
    probability: 0,
    ownerId: getDemoOwnerIdByName('Corbin'),
    nextStep: 'Archive and revisit next quarter',
    lastActivityAt: '2026-06-20',
  },
]
