import {
  type LeadRecord,
  type LeadSource,
  type LeadStage,
  type LeadStatus,
} from '@/lib/sales/demoSalesRecords'
import { getLocalTimestamp } from '@/lib/formatting/dates'

export type CreateLeadInput = {
  name: string
  company?: string
  contactEmail?: string
  contactPhone?: string
  source: LeadSource
  stage: LeadStage
  value?: string
  ownerId: string
  followUpDue?: string
  nextStep?: string
  notes?: string
  sharedNotes?: string
}

export type CreateLeadField =
  | 'name'
  | 'contactEmail'
  | 'source'
  | 'stage'
  | 'value'
  | 'ownerId'
  | 'followUpDue'

export type CreateLeadValidation = {
  valid: boolean
  errors: Partial<Record<CreateLeadField, string>>
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateCreateLeadInput(
  input: CreateLeadInput,
): CreateLeadValidation {
  const errors: CreateLeadValidation['errors'] = {}
  const trimmedName = input.name.trim()
  const trimmedEmail = input.contactEmail?.trim() ?? ''
  const value = input.value?.trim() ?? ''

  if (!trimmedName) {
    errors.name = 'Lead name is required.'
  }
  if (!input.source) {
    errors.source = 'Lead source is required.'
  }
  if (!input.stage) {
    errors.stage = 'Lead stage is required.'
  }
  if (!input.ownerId) {
    errors.ownerId = 'Lead owner is required.'
  }
  if (trimmedEmail && !emailPattern.test(trimmedEmail)) {
    errors.contactEmail = 'Enter a valid email address.'
  }
  if (value) {
    const parsedValue = Number(value)
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      errors.value = 'Estimated value must be zero or higher.'
    }
  }
  if (input.followUpDue && !/^\d{4}-\d{2}-\d{2}$/.test(input.followUpDue)) {
    errors.followUpDue = 'Enter a valid follow-up date.'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

export function findPotentialLeadDuplicate(
  input: Pick<CreateLeadInput, 'name' | 'company' | 'contactEmail'>,
  leads: LeadRecord[],
) {
  const email = normalizeText(input.contactEmail)
  const name = normalizeText(input.name)
  const company = normalizeText(input.company)

  return leads.find((lead) => {
    if (email && normalizeText(lead.contactEmail) === email) return true
    return (
      Boolean(name) &&
      normalizeText(lead.name) === name &&
      normalizeText(lead.company) === company
    )
  })
}

export function getLeadDuplicateWarning(
  input: Pick<CreateLeadInput, 'name' | 'company' | 'contactEmail'>,
  leads: LeadRecord[],
) {
  const duplicate = findPotentialLeadDuplicate(input, leads)
  if (!duplicate) return null
  return `${duplicate.name} is already tracked as a lead. You can still save this as a separate record.`
}

export function createPreviewLeadRecord({
  input,
  existingLeads,
  now = new Date(),
}: {
  input: CreateLeadInput
  existingLeads: LeadRecord[]
  now?: Date
}) {
  const timestamp = getLocalTimestamp(now)
  const id = createUniqueLeadId(input, existingLeads, now)
  const stage = input.stage
  const status = getStatusForStage(stage)
  const value = Number(input.value)
  const notes = input.notes?.trim() ?? ''

  return {
    id,
    name: input.name.trim(),
    company: input.company?.trim() || 'Independent lead',
    sharedContactId: `contact-${id}`,
    contactEmail: input.contactEmail?.trim() || undefined,
    contactPhone: input.contactPhone?.trim() || undefined,
    status,
    stage,
    source: input.source,
    value: Number.isFinite(value) ? value : 0,
    nextStep: input.nextStep?.trim() || 'Review lead and schedule follow-up',
    ownerId: input.ownerId,
    createdAt: timestamp,
    lastActivityAt: timestamp,
    followUpDue: input.followUpDue || undefined,
    converted: false,
    leadNotes: notes || undefined,
    notes,
  } satisfies LeadRecord
}

function getStatusForStage(stage: LeadStage): LeadStatus {
  if (stage === 'Converted') return 'Converted'
  if (stage === 'Disqualified' || stage === 'Lost') return 'Disqualified'
  if (stage === 'Won') return 'Qualified'
  if (stage === 'Estimate / Visit' || stage === 'Follow-Up') return 'Contacted'
  if (stage === 'Contacted') return 'Contacted'
  if (stage === 'Qualified') return 'Qualified'
  if (stage === 'Nurture') return 'Nurture'
  return 'New'
}

function createUniqueLeadId(
  input: Pick<CreateLeadInput, 'name' | 'company'>,
  existingLeads: LeadRecord[],
  now: Date,
) {
  const base =
    slugify([input.name, input.company].filter(Boolean).join(' ')) ||
    `manual-${now.getTime()}`
  const existingIds = new Set(existingLeads.map((lead) => lead.id))
  let candidate = `lead-${base}`
  let suffix = 2

  while (existingIds.has(candidate)) {
    candidate = `lead-${base}-${suffix}`
    suffix += 1
  }

  return candidate
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
