'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Clipboard,
  Eye,
  RefreshCcw,
  RotateCcw,
  Trash2,
  Wand2,
} from 'lucide-react'
import type {
  DemoScenarioPreset,
  DemoWorkspaceGenerationConfig,
} from '@/lib/dev/demoWorkspaceGenerator'

type DemoSummary = {
  exists: boolean
  businessName: string
  teams: number
  locations: number
  technicians: number
  customers: number
  appointments: number
  availabilityRecords: number
  recurringMasters: number
  schedulingContacts?: number
  crmClients?: number
}

type ToolboxState = {
  workspace: {
    id: string
    name: string
    slug: string
    suggestedSlug: string
    machineGeneratedSlug: boolean
  }
  demo: DemoSummary
}

type ApiResponse = Partial<ToolboxState> & {
  ok?: boolean
  error?: string
  oldSlug?: string
  newSlug?: string
  canonicalPath?: string
  summary?: Record<string, unknown>
  plannedSummary?: Record<string, unknown>
  resolvedConfig?: DemoWorkspaceGenerationConfig
  deleted?: Record<string, number>
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50'

const presetOptions: Array<{
  value: DemoScenarioPreset | 'custom'
  label: string
}> = [
  { value: 'service-business-growth', label: 'Mechanical Services' },
  { value: 'scheduling-balanced', label: 'Balanced Service Business' },
  { value: 'scheduling-overloaded', label: 'Busy Dispatch Week' },
  { value: 'dispatch-chaos', label: 'Scheduling Conflicts' },
  { value: 'ai-playground-comprehensive', label: 'Recurring Services Heavy' },
  { value: 'clean-small-business', label: 'Minimal Clean Workspace' },
  { value: 'custom', label: 'Custom' },
]

const scenarioFields = [
  ['overloaded member', 'concentratedRecurringWorkload'],
  ['double booking', 'doubleBooking'],
  ['PTO overlap', 'ptoConflict'],
  ['unassigned work', 'unassignedWork'],
  ['after-hours emergency', 'afterHoursEmergency'],
  ['certification mismatch', 'certificationMismatch'],
  ['location mismatch', 'locationMismatch'],
  ['long travel', 'longTravel'],
  ['recurring collision', 'recurringCollision'],
  ['requested unavailable member', 'requestedUnavailableMember'],
  ['external-calendar busy conflict', 'externalCalendarBusyConflict'],
] as const

export function DevelopmentDemoWorkspaceToolbox({
  initialState,
}: {
  initialState: ToolboxState
}) {
  const router = useRouter()
  const [state, setState] = useState(initialState)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<
    DemoScenarioPreset | 'custom'
  >('service-business-growth')
  const [seed, setSeed] = useState(42)
  const [anchorDate, setAnchorDate] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [eventCount, setEventCount] = useState(60)
  const [memberCount, setMemberCount] = useState(8)
  const [teamCount, setTeamCount] = useState(3)
  const [locationCount, setLocationCount] = useState(2)
  const [schedulingContactCount, setSchedulingContactCount] = useState(24)
  const [recurringSeriesCount, setRecurringSeriesCount] = useState(8)
  const [availabilityRecordCount, setAvailabilityRecordCount] = useState(10)
  const [emergencyEventCount, setEmergencyEventCount] = useState(3)
  const [unassignedPercent, setUnassignedPercent] = useState(10)
  const [completedPercent, setCompletedPercent] = useState(10)
  const [canceledPercent, setCanceledPercent] = useState(5)
  const [dateRangeDistribution, setDateRangeDistribution] = useState<
    'balanced' | 'past-heavy' | 'upcoming-heavy'
  >('upcoming-heavy')
  const [workloadDistribution, setWorkloadDistribution] = useState<
    'balanced' | 'overloaded' | 'chaotic'
  >('balanced')
  const [description, setDescription] = useState('')
  const [scenarios, setScenarios] = useState<Record<string, boolean>>({
    doubleBooking: true,
    ptoConflict: true,
    unassignedWork: true,
  })
  const [dryRun, setDryRun] = useState<{
    plannedSummary?: Record<string, unknown>
    resolvedConfig?: DemoWorkspaceGenerationConfig
  } | null>(null)

  const endpoint = `/api/workspaces/${state.workspace.id}/admin/dev/demo-workspace`
  const cliCommand = useMemo(
    () => `npm run demo:workspace -- --workspace-slug ${state.workspace.slug}`,
    [state.workspace.slug],
  )
  const currentConfig = useMemo<DemoWorkspaceGenerationConfig>(
    () => ({
      preset:
        selectedPreset === 'custom' ? 'scheduling-balanced' : selectedPreset,
      seed,
      anchorDate: anchorDate || undefined,
      timezone,
      naturalLanguageDescription: description.trim() || undefined,
      teamCount,
      locationCount,
      memberCount,
      schedulingContactCount,
      recurringSeriesCount,
      emergencyEventCount,
      availabilityRecordCount,
      scheduling: {
        eventCount,
        unassignedPercent,
        completedPercent,
        canceledPercent,
        dateRangeDistribution,
        workloadDistribution,
      },
      scenarios: Object.fromEntries(
        scenarioFields
          .filter(([, key]) => scenarios[key])
          .map(([, key]) => [key, 1]),
      ) as DemoWorkspaceGenerationConfig['scenarios'],
      unsupportedModules: [
        'CRM Clients',
        'Service Requests',
        'Marketing attribution',
        'Finance',
      ],
    }),
    [
      selectedPreset,
      seed,
      anchorDate,
      timezone,
      description,
      teamCount,
      locationCount,
      memberCount,
      schedulingContactCount,
      recurringSeriesCount,
      emergencyEventCount,
      availabilityRecordCount,
      eventCount,
      unassignedPercent,
      completedPercent,
      canceledPercent,
      dateRangeDistribution,
      workloadDistribution,
      scenarios,
    ],
  )
  const cliCommandWithConfig = useMemo(
    () =>
      `${cliCommand} --preset ${currentConfig.preset ?? 'scheduling-balanced'} --seed ${currentConfig.seed ?? 42} --event-count ${currentConfig.scheduling?.eventCount ?? 60}`,
    [cliCommand, currentConfig],
  )

  async function runOperation(operation: string, useAdvancedConfig = false) {
    if (
      (operation === 'reset' || operation === 'regenerate') &&
      !window.confirm(
        operation === 'reset'
          ? 'Reset Demo Data? Only records created by the Skillify demo generator will be removed.'
          : 'Regenerate Demo Data? Existing demo records will be replaced and non-demo records will be preserved.',
      )
    ) {
      return
    }

    setPending(operation)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          ...(useAdvancedConfig
            ? {
                anchorDate: anchorDate || undefined,
                timezone,
                config: currentConfig,
              }
            : {}),
        }),
      })
      const payload = (await response.json()) as ApiResponse
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? 'Development operation failed.')
      }
      if (payload.workspace && payload.demo) {
        setState({ workspace: payload.workspace, demo: payload.demo })
      }
      if (payload.plannedSummary || payload.resolvedConfig) {
        setDryRun({
          plannedSummary: payload.plannedSummary,
          resolvedConfig: payload.resolvedConfig,
        })
      }
      if (operation === 'regenerateSlug' && payload.canonicalPath) {
        router.replace(payload.canonicalPath)
        router.refresh()
      }
      setMessage(
        operation === 'reset'
          ? 'Demo data reset.'
          : operation === 'dryRun'
            ? 'Dry-run preview prepared.'
            : operation === 'generate'
              ? 'Demo data generated.'
              : operation === 'regenerate'
                ? 'Demo data regenerated.'
                : operation === 'regenerateSlug'
                  ? `Workspace URL updated from ${payload.oldSlug} to ${payload.newSlug}.`
                  : 'Summary refreshed.',
      )
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : 'Development operation failed.',
      )
    } finally {
      setPending(null)
    }
  }

  const counts = [
    ['Teams', state.demo.teams],
    ['Locations', state.demo.locations],
    ['Technicians', state.demo.technicians],
    [
      'Scheduling Contacts',
      state.demo.schedulingContacts ?? state.demo.customers,
    ],
    ['CRM Clients', state.demo.crmClients ?? 0],
    ['Appointments', state.demo.appointments],
    ['Availability', state.demo.availabilityRecords],
    ['Recurring masters', state.demo.recurringMasters],
  ] as const

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 shadow-sm shadow-slate-950/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
              Development only
            </div>
            <h2 className="mt-2 text-lg font-semibold text-slate-50">
              Development Demo Workspace
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Demo actions affect only records created by the Skillify demo
              generator. Non-demo workspace data is preserved.
            </p>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300">
            {state.demo.exists ? 'Demo data detected' : 'No demo data detected'}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {counts.map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
            >
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {label}
              </div>
              <div className="mt-1 text-xl font-semibold text-slate-100">
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className={`${buttonBase} border-cyan-500/40 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15`}
            disabled={pending !== null}
            onClick={() => runOperation('generate')}
          >
            <Wand2 className="h-4 w-4" />
            Generate Demo Data
          </button>
          <button
            type="button"
            className={`${buttonBase} border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800`}
            disabled={pending !== null}
            onClick={() => runOperation('regenerate')}
          >
            <RotateCcw className="h-4 w-4" />
            Regenerate Demo Data
          </button>
          <button
            type="button"
            className={`${buttonBase} border-rose-500/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15`}
            disabled={pending !== null}
            onClick={() => runOperation('reset')}
          >
            <Trash2 className="h-4 w-4" />
            Reset Demo Data
          </button>
          <button
            type="button"
            className={`${buttonBase} border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900`}
            disabled={pending !== null}
            onClick={() => runOperation('summary')}
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh Summary
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900/40">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            onClick={() => setAdvancedOpen((current) => !current)}
            aria-expanded={advancedOpen}
          >
            <span>
              <span className="block text-sm font-semibold text-slate-100">
                Advanced Demo Configuration
              </span>
              <span className="mt-1 block text-xs text-slate-400">
                Build a deterministic dry run from typed generator settings
                before creating records.
              </span>
            </span>
            <Eye className="h-4 w-4 text-slate-400" />
          </button>
          {advancedOpen ? (
            <div className="space-y-4 border-t border-slate-800 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Preset">
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    value={selectedPreset}
                    onChange={(event) =>
                      setSelectedPreset(
                        event.target.value as DemoScenarioPreset | 'custom',
                      )
                    }
                  >
                    {presetOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <NumberField label="Seed" value={seed} onChange={setSeed} />
                <Field label="Anchor date">
                  <input
                    type="date"
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    value={anchorDate}
                    onChange={(event) => setAnchorDate(event.target.value)}
                  />
                </Field>
                <Field label="Timezone">
                  <input
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                  />
                </Field>
                <NumberField
                  label="Team count"
                  value={teamCount}
                  onChange={setTeamCount}
                />
                <NumberField
                  label="Location count"
                  value={locationCount}
                  onChange={setLocationCount}
                />
                <NumberField
                  label="Member/technician count"
                  value={memberCount}
                  onChange={setMemberCount}
                />
                <NumberField
                  label="Scheduling contact count"
                  value={schedulingContactCount}
                  onChange={setSchedulingContactCount}
                />
                <NumberField
                  label="Appointment/event count"
                  value={eventCount}
                  onChange={setEventCount}
                />
                <NumberField
                  label="Recurring series count"
                  value={recurringSeriesCount}
                  onChange={setRecurringSeriesCount}
                />
                <NumberField
                  label="Emergency event count"
                  value={emergencyEventCount}
                  onChange={setEmergencyEventCount}
                />
                <NumberField
                  label="Availability/time-off count"
                  value={availabilityRecordCount}
                  onChange={setAvailabilityRecordCount}
                />
                <NumberField
                  label="% unassigned"
                  value={unassignedPercent}
                  onChange={setUnassignedPercent}
                />
                <NumberField
                  label="% completed"
                  value={completedPercent}
                  onChange={setCompletedPercent}
                />
                <NumberField
                  label="% canceled"
                  value={canceledPercent}
                  onChange={setCanceledPercent}
                />
                <Field label="Date-range distribution">
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    value={dateRangeDistribution}
                    onChange={(event) =>
                      setDateRangeDistribution(
                        event.target.value as typeof dateRangeDistribution,
                      )
                    }
                  >
                    <option value="balanced">Balanced</option>
                    <option value="past-heavy">Past-heavy</option>
                    <option value="upcoming-heavy">Upcoming-heavy</option>
                  </select>
                </Field>
                <Field label="Workload distribution">
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    value={workloadDistribution}
                    onChange={(event) =>
                      setWorkloadDistribution(
                        event.target.value as typeof workloadDistribution,
                      )
                    }
                  >
                    <option value="balanced">Balanced</option>
                    <option value="overloaded">Overloaded</option>
                    <option value="chaotic">Chaotic</option>
                  </select>
                </Field>
              </div>
              <Field label="Describe the demo workspace">
                <textarea
                  className="min-h-20 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Create a busy HVAC company with 8 technicians, 40 upcoming jobs, five unassigned jobs..."
                />
                <p className="mt-1 text-xs text-slate-500">
                  Free-form text is preserved as configuration context only. The
                  deterministic generator remains authoritative.
                </p>
              </Field>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {scenarioFields.map(([label, key]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(scenarios[key])}
                      onChange={(event) =>
                        setScenarios((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`${buttonBase} border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800`}
                  disabled={pending !== null}
                  onClick={() => runOperation('dryRun', true)}
                >
                  <Eye className="h-4 w-4" />
                  Preview Dry Run
                </button>
                <button
                  type="button"
                  className={`${buttonBase} border-cyan-500/40 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15`}
                  disabled={pending !== null}
                  onClick={() => runOperation('generate', true)}
                >
                  <Wand2 className="h-4 w-4" />
                  Generate Reviewed Config
                </button>
                <button
                  type="button"
                  className={`${buttonBase} border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900`}
                  onClick={() =>
                    navigator.clipboard?.writeText(
                      JSON.stringify(currentConfig, null, 2),
                    )
                  }
                >
                  <Clipboard className="h-4 w-4" />
                  Copy Config JSON
                </button>
                <button
                  type="button"
                  className={`${buttonBase} border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900`}
                  onClick={() =>
                    navigator.clipboard?.writeText(cliCommandWithConfig)
                  }
                >
                  <Clipboard className="h-4 w-4" />
                  Copy CLI Command
                </button>
              </div>
              {dryRun ? (
                <pre className="max-h-80 overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs leading-5 text-slate-300">
                  {JSON.stringify(dryRun, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 shadow-sm shadow-slate-950/30">
        <h2 className="text-lg font-semibold text-slate-50">Workspace URL</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Info label="Name" value={state.workspace.name} />
          <Info label="Current slug" value={state.workspace.slug} />
          <Info label="Suggested slug" value={state.workspace.suggestedSlug} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`${buttonBase} border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800`}
            disabled={
              pending !== null ||
              state.workspace.slug === state.workspace.suggestedSlug
            }
            onClick={() => runOperation('regenerateSlug')}
          >
            Update Slug
          </button>
          <code className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
            {cliCommand}
          </code>
        </div>
      </section>

      {pending ? <p className="text-sm text-cyan-200">Working...</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={0}
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 break-all text-sm font-medium text-slate-100">
        {value}
      </div>
    </div>
  )
}
