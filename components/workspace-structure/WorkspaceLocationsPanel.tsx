'use client'

import { useEffect, useState } from 'react'
import { Edit3, MapPin, RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  formatWorkspaceLocationAddress,
  formatWorkspaceLocationType,
  WorkspaceLocationForm,
} from '@/components/workspace-structure/WorkspaceLocationForm'
import type { WorkspaceLocationSummary } from '@/lib/workspaceStructure/types'
import {
  getWorkspaceStructureErrorMessage,
  type WorkspaceStructureApiError,
} from './workspaceStructureClientErrors'

export function WorkspaceLocationsPanel({
  workspaceId,
  workspaceTimezone,
  canManage,
}: {
  workspaceId: string
  workspaceTimezone: string
  canManage: boolean
}) {
  const [locations, setLocations] = useState<WorkspaceLocationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingLocation, setEditingLocation] =
    useState<WorkspaceLocationSummary | null>(null)
  const [error, setError] = useState('')

  const loadLocations = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/locations?includeArchived=${showArchived}`,
        { cache: 'no-store' },
      )
      const data = (await response.json().catch(() => ({}))) as {
        locations?: WorkspaceLocationSummary[]
      } & WorkspaceStructureApiError
      if (!response.ok) {
        throw new Error(
          getWorkspaceStructureErrorMessage({
            data,
            fallback: 'Locations could not be loaded. Try again.',
          }),
        )
      }
      setLocations(data.locations ?? [])
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Locations could not be loaded. Try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLocations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, showArchived])

  const archiveLocation = async (location: WorkspaceLocationSummary) => {
    await fetch(`/api/workspaces/${workspaceId}/locations/${location.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: location.archivedAt ? 'restore' : 'archive',
      }),
    })
    await loadLocations()
  }

  const filteredLocations = locations.filter((location) =>
    [
      location.name,
      location.locationType,
      location.addressLine1,
      location.city,
      location.region,
    ]
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  return (
    <Card className="space-y-4 p-5 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-50">
            Business Locations
          </h2>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            Manage reusable workspace operational locations for availability and
            scheduling.
          </p>
        </div>
        {canManage ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCreating(true)}
          >
            Add Location
          </Button>
        ) : null}
      </div>

      {creating || editingLocation ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <WorkspaceLocationForm
            workspaceId={workspaceId}
            workspaceTimezone={workspaceTimezone}
            initialLocation={editingLocation}
            onCancel={() => {
              setCreating(false)
              setEditingLocation(null)
            }}
            onSaved={(location) => {
              setLocations((current) => [
                location,
                ...current
                  .filter((item) => item.id !== location.id)
                  .map((item) =>
                    location.isPrimary ? { ...item, isPrimary: false } : item,
                  ),
              ])
              setCreating(false)
              setEditingLocation(null)
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Search business locations"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search locations"
          className="text-neutral-text-primary placeholder:text-neutral-text-secondary/70 focus:border-brand-primary/70 focus:ring-brand-primary/60 min-w-56 flex-1 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm outline-none focus:ring-1"
        />
        <Button
          type="button"
          size="sm"
          variant={showArchived ? 'secondary' : 'outline'}
          onClick={() => setShowArchived((current) => !current)}
        >
          {showArchived ? 'Hide archived' : 'Show archived'}
        </Button>
      </div>

      {error && !creating && !editingLocation ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/[0.08] p-3 text-sm text-rose-100">
          <p>{error}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={loadLocations}
          >
            Retry
          </Button>
        </div>
      ) : null}
      {loading ? (
        <p className="text-neutral-text-secondary text-sm">
          Loading business locations...
        </p>
      ) : filteredLocations.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredLocations.map((location) => (
            <div
              key={location.id}
              className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-neutral-50">
                      {location.name}
                    </p>
                    {location.isPrimary ? (
                      <Badge variant="blue">Primary</Badge>
                    ) : null}
                    <Badge variant={location.archivedAt ? 'default' : 'green'}>
                      {location.archivedAt ? 'Archived' : 'Active'}
                    </Badge>
                  </div>
                  <p className="text-neutral-text-secondary mt-1 text-xs">
                    {formatWorkspaceLocationType(location.locationType)} ·{' '}
                    {location.timezone ?? workspaceTimezone}
                  </p>
                  <p className="text-neutral-text-secondary mt-2 text-sm">
                    {formatWorkspaceLocationAddress(location) ||
                      'No address configured'}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      leftIcon={<Edit3 className="h-3.5 w-3.5" />}
                      onClick={() => setEditingLocation(location)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      leftIcon={
                        location.archivedAt ? (
                          <RotateCcw className="h-3.5 w-3.5" />
                        ) : (
                          <MapPin className="h-3.5 w-3.5" />
                        )
                      }
                      onClick={() => archiveLocation(location)}
                    >
                      {location.archivedAt ? 'Restore' : 'Archive'}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
          <p className="font-medium text-neutral-100">
            No business locations yet.
          </p>
          <p className="text-neutral-text-secondary mt-1 text-sm">
            Add Location to configure Location Hours and operational bases.
          </p>
        </div>
      )}
    </Card>
  )
}
