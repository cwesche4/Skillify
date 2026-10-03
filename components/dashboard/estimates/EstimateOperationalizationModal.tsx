'use client'

import React, { useMemo, useState } from 'react'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  EstimatesApiError,
  operationalizeEstimate,
  type EstimateOperationalizationRequest,
} from '@/lib/estimates/client'
import type {
  EstimateClientOperationalCustomer,
  EstimateClientRecord,
} from '@/lib/estimates/clientTypes'
import { combineDateAndTimeInTimezone } from '@/lib/scheduling/schedulingDateTime'

type Choice = { id: string; name: string }
type StepDraft = {
  selected: boolean
  title: string
  description: string
}
type RecurringDraft = {
  instructions: string
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  date: string
  time: string
  duration: string
  frequency: '' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: string
  weekdays: number[]
  endType: '' | 'never' | 'onDate' | 'afterOccurrences'
  endDate: string
  occurrenceCount: string
  locationType: '' | 'customerLocation' | 'physicalAddress' | 'toBeDetermined'
  locationLabel: string
  locationAddress: string
  assignment: string
  templates: string
}

const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const
const weekdays = [
  ['Sun', 0],
  ['Mon', 1],
  ['Tue', 2],
  ['Wed', 3],
  ['Thu', 4],
  ['Fri', 5],
  ['Sat', 6],
] as const

function customerAddress(customer: EstimateClientOperationalCustomer) {
  return [
    customer.serviceAddressLine1,
    customer.serviceAddressLine2,
    [
      customer.serviceAddressCity,
      customer.serviceAddressRegion,
      customer.serviceAddressPostalCode,
    ]
      .filter(Boolean)
      .join(', '),
    customer.serviceAddressCountry,
  ]
    .filter(Boolean)
    .join('\n')
}

function estimateAddress(estimate: EstimateClientRecord) {
  return [
    estimate.serviceAddressLine1Snapshot,
    estimate.serviceAddressLine2Snapshot,
    [
      estimate.serviceAddressCitySnapshot,
      estimate.serviceAddressRegionSnapshot,
      estimate.serviceAddressPostalCodeSnapshot,
    ]
      .filter(Boolean)
      .join(', '),
    estimate.serviceAddressCountrySnapshot,
  ]
    .filter(Boolean)
    .join('\n')
}

function assignment(value: string) {
  const [kind, id] = value.split(':', 2)
  if (!id) return []
  return kind === 'MEMBER'
    ? [{ assignmentType: 'MEMBER' as const, workspaceMemberId: id }]
    : [{ assignmentType: 'TEAM' as const, teamId: id }]
}

function initialRecurring(): RecurringDraft {
  return {
    instructions: '',
    priority: 'NORMAL',
    date: '',
    time: '',
    duration: '',
    frequency: '',
    interval: '1',
    weekdays: [],
    endType: '',
    endDate: '',
    occurrenceCount: '',
    locationType: '',
    locationLabel: '',
    locationAddress: '',
    assignment: '',
    templates: '',
  }
}

export function EstimateOperationalizationModal({
  isOpen,
  estimate,
  customer,
  workspaceId,
  timezone,
  members,
  teams,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  estimate: EstimateClientRecord
  customer: EstimateClientOperationalCustomer
  workspaceId: string
  timezone: string
  members: Choice[]
  teams: Choice[]
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const oneTimeLines = estimate.lineItems.filter(
    (line) => line.billingBasis === 'ONE_TIME',
  )
  const recurringLines = estimate.lineItems.filter(
    (line) => line.billingBasis === 'PER_VISIT',
  )
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [jobTitle, setJobTitle] = useState(estimate.title)
  const [jobNotes, setJobNotes] = useState('')
  const [jobPriority, setJobPriority] = useState<
    'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  >('NORMAL')
  const [scheduleJob, setScheduleJob] = useState(false)
  const [jobDate, setJobDate] = useState('')
  const [jobTime, setJobTime] = useState('')
  const [jobDuration, setJobDuration] = useState('')
  const [jobAssignment, setJobAssignment] = useState('')
  const [steps, setSteps] = useState<Record<string, StepDraft>>(() =>
    Object.fromEntries(
      oneTimeLines.map((line) => [
        line.id,
        {
          selected: true,
          title: line.title,
          description: line.description ?? '',
        },
      ]),
    ),
  )
  const [recurring, setRecurring] = useState<Record<string, RecurringDraft>>(
    () =>
      Object.fromEntries(
        recurringLines.map((line) => [line.id, initialRecurring()]),
      ),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const customerChanged = useMemo(
    () =>
      (estimate.contactNameSnapshot ?? '') !== (customer.contactName ?? '') ||
      (estimate.contactEmailSnapshot ?? '') !== (customer.email ?? '') ||
      (estimate.contactPhoneSnapshot ?? '') !== (customer.phone ?? '') ||
      estimateAddress(estimate) !== customerAddress(customer),
    [customer, estimate],
  )

  function setRecurringField<K extends keyof RecurringDraft>(
    lineId: string,
    field: K,
    value: RecurringDraft[K],
  ) {
    setRecurring((current) => ({
      ...current,
      [lineId]: { ...current[lineId], [field]: value },
    }))
  }

  function instant(date: string, time: string) {
    if (!date || !time) throw new Error('Choose a date and time.')
    return combineDateAndTimeInTimezone({ dateKey: date, time, timezone })
  }

  function makeRequest(): EstimateOperationalizationRequest {
    const oneTime = oneTimeLines.length
      ? (() => {
          let scheduledStartAt: string | undefined
          let scheduledEndAt: string | undefined
          if (scheduleJob) {
            const duration = Number(jobDuration)
            if (!Number.isInteger(duration) || duration < 1) {
              throw new Error('Enter the one-time Job duration in minutes.')
            }
            if (!jobAssignment) {
              throw new Error('Assign the scheduled one-time Job.')
            }
            const start = instant(jobDate, jobTime)
            scheduledStartAt = start.toISOString()
            scheduledEndAt = new Date(
              start.getTime() + duration * 60_000,
            ).toISOString()
          }
          return {
            title: jobTitle,
            notes: jobNotes || null,
            priority: jobPriority,
            scheduledStartAt,
            scheduledEndAt,
            assignments: assignment(jobAssignment),
            lineItems: oneTimeLines.map((line) => ({
              estimateLineItemId: line.id,
              createJobStep: steps[line.id].selected,
              stepTitle: steps[line.id].selected
                ? steps[line.id].title
                : undefined,
              stepDescription: steps[line.id].selected
                ? steps[line.id].description || null
                : undefined,
            })),
          }
        })()
      : undefined
    return {
      expectedVersion: estimate.version,
      idempotencyKey,
      oneTime,
      recurring: recurringLines.map((line) => {
        const draft = recurring[line.id]
        const duration = Number(draft.duration)
        const interval = Number(draft.interval)
        if (!draft.frequency || !draft.endType || !draft.locationType) {
          throw new Error(
            `Complete recurrence, end, and location choices for ${line.title}.`,
          )
        }
        if (!draft.assignment) {
          throw new Error(`Assign ${line.title} to a member or team.`)
        }
        if (!Number.isInteger(duration) || duration < 1) {
          throw new Error(`Enter a duration for ${line.title}.`)
        }
        if (!Number.isInteger(interval) || interval < 1) {
          throw new Error(`Enter a recurrence interval for ${line.title}.`)
        }
        if (draft.frequency === 'weekly' && !draft.weekdays.length) {
          throw new Error(`Choose at least one weekday for ${line.title}.`)
        }
        if (draft.endType === 'onDate' && !draft.endDate) {
          throw new Error(`Choose an end date for ${line.title}.`)
        }
        if (
          draft.endType === 'afterOccurrences' &&
          (!Number.isInteger(Number(draft.occurrenceCount)) ||
            Number(draft.occurrenceCount) < 1)
        ) {
          throw new Error(`Enter an occurrence count for ${line.title}.`)
        }
        const start = instant(draft.date, draft.time)
        return {
          estimateLineItemId: line.id,
          serviceInstructions: draft.instructions || null,
          priority: draft.priority,
          stepTemplates: draft.templates
            .split('\n')
            .map((title) => title.trim())
            .filter(Boolean)
            .map((title) => ({ title, description: null })),
          schedule: {
            startsAt: start.toISOString(),
            endsAt: new Date(start.getTime() + duration * 60_000).toISOString(),
            timezone,
            recurrenceRule: {
              frequency: draft.frequency,
              interval,
              daysOfWeek:
                draft.frequency === 'weekly' ? draft.weekdays : undefined,
              endType: draft.endType,
              endDate: draft.endType === 'onDate' ? draft.endDate : undefined,
              occurrenceCount:
                draft.endType === 'afterOccurrences'
                  ? Number(draft.occurrenceCount)
                  : undefined,
            },
            locationType: draft.locationType,
            locationLabel:
              draft.locationType === 'physicalAddress'
                ? draft.locationLabel || null
                : undefined,
            locationAddress:
              draft.locationType === 'physicalAddress'
                ? draft.locationAddress || null
                : undefined,
            assignments: assignment(draft.assignment),
          },
        }
      }),
    }
  }

  async function submit() {
    setError(null)
    setSaving(true)
    try {
      await operationalizeEstimate(workspaceId, estimate.id, makeRequest())
      await onCreated()
    } catch (submitError) {
      if (
        submitError instanceof EstimatesApiError &&
        submitError.code === 'ALREADY_OPERATIONALIZED'
      ) {
        await onCreated()
        return
      }
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No operational work was created. Review the handoff and try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title="Create Operational Work"
      description="Review current customer details and configure every accepted line before final confirmation."
      size="lg"
    >
      <div className="max-h-[75vh] space-y-6 overflow-y-auto pr-1">
        {error ? <Alert variant="error">{error}</Alert> : null}
        <section className="border-app rounded-xl border p-4">
          <h3 className="text-app-primary font-medium">Customer review</h3>
          <p className="text-app-primary mt-2 text-sm">
            {customer.displayName}
          </p>
          <p className="text-app-muted mt-1 whitespace-pre-line text-xs">
            {customer.contactName || 'No contact name'} ·{' '}
            {customer.email || 'No email'} · {customer.phone || 'No phone'}
            {'\n'}
            {customerAddress(customer) || 'No current service address'}
          </p>
          {customerChanged ? (
            <Alert variant="warning" className="mt-3">
              Current Customer details differ from the accepted Estimate. The
              Estimate stays unchanged; new work will use the current Customer
              contact and service location shown above.
            </Alert>
          ) : null}
        </section>

        {oneTimeLines.length ? (
          <section className="space-y-4">
            <h3 className="text-app-primary font-semibold">One-time work</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Job title">
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </Field>
              <Field label="Priority">
                <Select
                  value={jobPriority}
                  onChange={(e) =>
                    setJobPriority(e.target.value as typeof jobPriority)
                  }
                >
                  {priorities.map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Operational notes">
              <Textarea
                value={jobNotes}
                onChange={(e) => setJobNotes(e.target.value)}
              />
            </Field>
            <div className="space-y-2">
              <p className="text-app-primary text-sm font-medium">
                Proposed Job Steps
              </p>
              {oneTimeLines.map((line) => (
                <div
                  key={line.id}
                  className="border-app grid gap-2 rounded-lg border p-3 sm:grid-cols-[auto_1fr]"
                >
                  <input
                    aria-label={`Create Job Step for ${line.title}`}
                    type="checkbox"
                    checked={steps[line.id].selected}
                    onChange={(e) =>
                      setSteps((current) => ({
                        ...current,
                        [line.id]: {
                          ...current[line.id],
                          selected: e.target.checked,
                        },
                      }))
                    }
                  />
                  <div className="space-y-2">
                    <Input
                      aria-label={`${line.title} step title`}
                      disabled={!steps[line.id].selected}
                      value={steps[line.id].title}
                      onChange={(e) =>
                        setSteps((current) => ({
                          ...current,
                          [line.id]: {
                            ...current[line.id],
                            title: e.target.value,
                          },
                        }))
                      }
                    />
                    <Textarea
                      aria-label={`${line.title} step description`}
                      disabled={!steps[line.id].selected}
                      value={steps[line.id].description}
                      onChange={(e) =>
                        setSteps((current) => ({
                          ...current,
                          [line.id]: {
                            ...current[line.id],
                            description: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <label className="text-app-primary flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={scheduleJob}
                onChange={(e) => setScheduleJob(e.target.checked)}
              />
              Schedule this Job now
            </label>
            {scheduleJob ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Date">
                  <Input
                    type="date"
                    value={jobDate}
                    onChange={(e) => setJobDate(e.target.value)}
                  />
                </Field>
                <Field label="Start time">
                  <Input
                    type="time"
                    value={jobTime}
                    onChange={(e) => setJobTime(e.target.value)}
                  />
                </Field>
                <Field label="Duration (minutes)">
                  <Input
                    type="number"
                    min="1"
                    value={jobDuration}
                    onChange={(e) => setJobDuration(e.target.value)}
                  />
                </Field>
                <Field label="Assignment">
                  <AssignmentSelect
                    value={jobAssignment}
                    onChange={setJobAssignment}
                    members={members}
                    teams={teams}
                    allowEmpty
                  />
                </Field>
              </div>
            ) : (
              <p className="text-app-muted text-xs">
                An unscheduled, unassigned OPEN Job will be created.
              </p>
            )}
          </section>
        ) : null}

        {recurringLines.map((line) => {
          const draft = recurring[line.id]
          return (
            <section
              key={line.id}
              className="border-app space-y-4 rounded-xl border p-4"
            >
              <div>
                <h3 className="text-app-primary font-semibold">{line.title}</h3>
                <p className="text-app-muted text-xs">
                  Accepted price: {(line.amountCents / 100).toFixed(2)}{' '}
                  {estimate.currency} per visit
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Start date">
                  <Input
                    type="date"
                    value={draft.date}
                    onChange={(e) =>
                      setRecurringField(line.id, 'date', e.target.value)
                    }
                  />
                </Field>
                <Field label="Local start time">
                  <Input
                    type="time"
                    value={draft.time}
                    onChange={(e) =>
                      setRecurringField(line.id, 'time', e.target.value)
                    }
                  />
                </Field>
                <Field label="Duration (minutes)">
                  <Input
                    type="number"
                    min="1"
                    value={draft.duration}
                    onChange={(e) =>
                      setRecurringField(line.id, 'duration', e.target.value)
                    }
                  />
                </Field>
                <Field label="Timezone">
                  <Input value={timezone} readOnly />
                </Field>
                <Field label="Frequency">
                  <Select
                    value={draft.frequency}
                    onChange={(e) =>
                      setRecurringField(
                        line.id,
                        'frequency',
                        e.target.value as RecurringDraft['frequency'],
                      )
                    }
                  >
                    <option value="">Choose…</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </Select>
                </Field>
                <Field label="Every">
                  <Input
                    type="number"
                    min="1"
                    value={draft.interval}
                    onChange={(e) =>
                      setRecurringField(line.id, 'interval', e.target.value)
                    }
                  />
                </Field>
              </div>
              {draft.frequency === 'weekly' ? (
                <div className="flex flex-wrap gap-2" aria-label="Weekdays">
                  {weekdays.map(([label, day]) => (
                    <label
                      key={day}
                      className="border-app rounded-lg border px-2 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        className="mr-1"
                        checked={draft.weekdays.includes(day)}
                        onChange={(e) =>
                          setRecurringField(
                            line.id,
                            'weekdays',
                            e.target.checked
                              ? [...draft.weekdays, day]
                              : draft.weekdays.filter((value) => value !== day),
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Ends">
                  <Select
                    value={draft.endType}
                    onChange={(e) =>
                      setRecurringField(
                        line.id,
                        'endType',
                        e.target.value as RecurringDraft['endType'],
                      )
                    }
                  >
                    <option value="">Choose…</option>
                    <option value="never">No planned end</option>
                    <option value="onDate">On date</option>
                    <option value="afterOccurrences">After visits</option>
                  </Select>
                </Field>
                {draft.endType === 'onDate' ? (
                  <Field label="End date">
                    <Input
                      type="date"
                      value={draft.endDate}
                      onChange={(e) =>
                        setRecurringField(line.id, 'endDate', e.target.value)
                      }
                    />
                  </Field>
                ) : null}
                {draft.endType === 'afterOccurrences' ? (
                  <Field label="Visit count">
                    <Input
                      type="number"
                      min="1"
                      value={draft.occurrenceCount}
                      onChange={(e) =>
                        setRecurringField(
                          line.id,
                          'occurrenceCount',
                          e.target.value,
                        )
                      }
                    />
                  </Field>
                ) : null}
                <Field label="Location">
                  <Select
                    value={draft.locationType}
                    onChange={(e) =>
                      setRecurringField(
                        line.id,
                        'locationType',
                        e.target.value as RecurringDraft['locationType'],
                      )
                    }
                  >
                    <option value="">Choose…</option>
                    <option value="customerLocation">
                      Current Customer location
                    </option>
                    <option value="physicalAddress">Another address</option>
                    <option value="toBeDetermined">To be determined</option>
                  </Select>
                </Field>
                <Field label="Assignment">
                  <AssignmentSelect
                    value={draft.assignment}
                    onChange={(value) =>
                      setRecurringField(line.id, 'assignment', value)
                    }
                    members={members}
                    teams={teams}
                  />
                </Field>
              </div>
              {draft.locationType === 'physicalAddress' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Location label">
                    <Input
                      value={draft.locationLabel}
                      onChange={(e) =>
                        setRecurringField(
                          line.id,
                          'locationLabel',
                          e.target.value,
                        )
                      }
                    />
                  </Field>
                  <Field label="Address">
                    <Input
                      value={draft.locationAddress}
                      onChange={(e) =>
                        setRecurringField(
                          line.id,
                          'locationAddress',
                          e.target.value,
                        )
                      }
                    />
                  </Field>
                </div>
              ) : null}
              <Field label="Service instructions">
                <Textarea
                  value={draft.instructions}
                  onChange={(e) =>
                    setRecurringField(line.id, 'instructions', e.target.value)
                  }
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Priority">
                  <Select
                    value={draft.priority}
                    onChange={(e) =>
                      setRecurringField(
                        line.id,
                        'priority',
                        e.target.value as RecurringDraft['priority'],
                      )
                    }
                  >
                    {priorities.map((priority) => (
                      <option key={priority}>{priority}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Optional Job Steps (one title per line)">
                  <Textarea
                    value={draft.templates}
                    onChange={(e) =>
                      setRecurringField(line.id, 'templates', e.target.value)
                    }
                  />
                </Field>
              </div>
            </section>
          )
        })}

        <section className="bg-app-surface rounded-xl p-4 text-sm">
          <h3 className="text-app-primary font-medium">Final summary</h3>
          <p className="text-app-muted mt-1">
            This will create {oneTimeLines.length ? '1 Job' : 'no Job'} and{' '}
            {recurringLines.length} Recurring Service
            {recurringLines.length === 1 ? '' : 's'}, with provenance for all{' '}
            {estimate.lineItems.length} accepted line items. No invoice,
            payment, or revenue record will be created.
          </p>
        </section>
        <div className="border-app flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void submit()}>
            Create Operational Work
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="text-app-muted block text-xs">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  )
}

function AssignmentSelect({
  value,
  onChange,
  members,
  teams,
  allowEmpty = false,
}: {
  value: string
  onChange: (value: string) => void
  members: Choice[]
  teams: Choice[]
  allowEmpty?: boolean
}) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{allowEmpty ? 'Unassigned' : 'Choose…'}</option>
      <optgroup label="Members">
        {members.map((member) => (
          <option key={member.id} value={`MEMBER:${member.id}`}>
            {member.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Teams">
        {teams.map((team) => (
          <option key={team.id} value={`TEAM:${team.id}`}>
            {team.name}
          </option>
        ))}
      </optgroup>
    </Select>
  )
}
