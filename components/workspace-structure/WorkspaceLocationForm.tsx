'use client'

import React from 'react'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  getSchedulingTimezoneOptions,
  normalizeSchedulingTimezone,
} from '@/lib/scheduling/schedulingTimezones'
import {
  workspaceLocationTypes,
  type WorkspaceLocationSummary,
  type WorkspaceLocationTypeValue,
} from '@/lib/workspaceStructure/types'
import {
  getWorkspaceStructureErrorMessage,
  type WorkspaceStructureApiError,
} from './workspaceStructureClientErrors'

const locationTypeLabels: Record<WorkspaceLocationTypeValue, string> = {
  office: 'Office',
  store: 'Store',
  warehouse: 'Warehouse',
  shop: 'Shop',
  serviceBase: 'Service base',
  branch: 'Branch',
  remote: 'Remote',
  other: 'Other',
}

export function formatWorkspaceLocationType(type?: string | null) {
  return (
    locationTypeLabels[(type as WorkspaceLocationTypeValue) ?? 'office'] ??
    'Office'
  )
}

export function formatWorkspaceLocationAddress(location: {
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  countryCode?: string | null
}) {
  const cityLine = [location.city, location.region, location.postalCode]
    .filter(Boolean)
    .join(', ')
  return [
    location.addressLine1,
    location.addressLine2,
    cityLine,
    location.countryCode,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function WorkspaceLocationForm({
  workspaceId,
  workspaceTimezone,
  initialLocation,
  submitLabel,
  onCancel,
  onSaved,
}: {
  workspaceId: string
  workspaceTimezone: string
  initialLocation?: WorkspaceLocationSummary | null
  submitLabel?: string
  onCancel: () => void
  onSaved: (location: WorkspaceLocationSummary) => void
}) {
  const [name, setName] = useState(initialLocation?.name ?? '')
  const [locationType, setLocationType] = useState<WorkspaceLocationTypeValue>(
    initialLocation?.locationType ?? 'office',
  )
  const [addressLine1, setAddressLine1] = useState(
    initialLocation?.addressLine1 ?? '',
  )
  const [addressLine2, setAddressLine2] = useState(
    initialLocation?.addressLine2 ?? '',
  )
  const [city, setCity] = useState(initialLocation?.city ?? '')
  const [region, setRegion] = useState(initialLocation?.region ?? '')
  const [postalCode, setPostalCode] = useState(
    initialLocation?.postalCode ?? '',
  )
  const [countryCode, setCountryCode] = useState(
    initialLocation?.countryCode ?? 'US',
  )
  const [timezone, setTimezone] = useState(
    normalizeSchedulingTimezone({
      timezone: initialLocation?.timezone,
      workspaceTimezone,
    }),
  )
  const [phone, setPhone] = useState(initialLocation?.phone ?? '')
  const [notes, setNotes] = useState(initialLocation?.notes ?? '')
  const [isPrimary, setIsPrimary] = useState(
    Boolean(initialLocation?.isPrimary),
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const timezoneOptions = getSchedulingTimezoneOptions()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(
        initialLocation
          ? `/api/workspaces/${workspaceId}/locations/${initialLocation.id}`
          : `/api/workspaces/${workspaceId}/locations`,
        {
          method: initialLocation ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: {
              name,
              locationType,
              addressLine1,
              addressLine2,
              city,
              region,
              postalCode,
              countryCode,
              timezone,
              phone,
              notes,
              isPrimary,
              isActive: true,
            },
          }),
        },
      )
      const data = (await response.json().catch(() => ({}))) as {
        location?: WorkspaceLocationSummary
      } & WorkspaceStructureApiError
      if (!response.ok || !data.location) {
        throw new Error(
          getWorkspaceStructureErrorMessage({
            data,
            fallback: 'Location could not be saved. Try again.',
          }),
        )
      }
      onSaved(data.location)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Location could not be saved.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-rose-400/35 bg-rose-500/[0.08] p-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      <label className="space-y-1">
        <span className="text-neutral-text-secondary text-xs font-medium">
          Location name
        </span>
        <Input
          aria-label="Location name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Main Office"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Location type
          </span>
          <Select
            aria-label="Location type"
            value={locationType}
            onChange={(event) =>
              setLocationType(event.target.value as WorkspaceLocationTypeValue)
            }
          >
            {workspaceLocationTypes.map((type) => (
              <option key={type} value={type}>
                {formatWorkspaceLocationType(type)}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Timezone
          </span>
          <Select
            aria-label="Location timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          >
            {timezoneOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <label className="space-y-1">
        <span className="text-neutral-text-secondary text-xs font-medium">
          Address
        </span>
        <Input
          aria-label="Address line 1"
          value={addressLine1}
          onChange={(event) => setAddressLine1(event.target.value)}
          placeholder="Address line 1"
        />
      </label>
      <Input
        aria-label="Address line 2"
        value={addressLine2}
        onChange={(event) => setAddressLine2(event.target.value)}
        placeholder="Address line 2"
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <Input
          aria-label="City"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="City"
          className="sm:col-span-2"
        />
        <Input
          aria-label="Region"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          placeholder="State"
        />
        <Input
          aria-label="Postal code"
          value={postalCode}
          onChange={(event) => setPostalCode(event.target.value)}
          placeholder="ZIP"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          aria-label="Country code"
          value={countryCode}
          onChange={(event) => setCountryCode(event.target.value)}
          placeholder="US"
        />
        <Input
          aria-label="Phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Phone"
        />
      </div>
      <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-neutral-100">
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(event) => setIsPrimary(event.target.checked)}
          className="h-4 w-4 rounded border-slate-700 bg-slate-950"
        />
        Primary business location
      </label>
      <label className="space-y-1">
        <span className="text-neutral-text-secondary text-xs font-medium">
          Notes
        </span>
        <Textarea
          aria-label="Location notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-[80px]"
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {submitLabel ?? (initialLocation ? 'Save Location' : 'Add Location')}
        </Button>
      </div>
    </form>
  )
}
