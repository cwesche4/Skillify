'use client'

import React from 'react'
import { useMemo, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  workspaceTeamTypes,
  type WorkspaceTeamSummary,
  type WorkspaceTeamTypeValue,
} from '@/lib/workspaceStructure/types'
import {
  getWorkspaceStructureErrorMessage,
  type WorkspaceStructureApiError,
} from './workspaceStructureClientErrors'

export type WorkspaceTeamMemberOption = {
  id: string
  label: string
  email?: string | null
}

const teamTypeLabels: Record<WorkspaceTeamTypeValue, string> = {
  general: 'General',
  office: 'Office',
  fieldCrew: 'Field crew',
  sales: 'Sales',
  service: 'Service',
  installation: 'Installation',
  warehouse: 'Warehouse',
  management: 'Management',
  other: 'Other',
}

export function formatWorkspaceTeamType(type?: string | null) {
  return (
    teamTypeLabels[(type as WorkspaceTeamTypeValue) ?? 'general'] ?? 'General'
  )
}

export function WorkspaceTeamForm({
  workspaceId,
  members,
  initialTeam,
  submitLabel,
  onCancel,
  onSaved,
}: {
  workspaceId: string
  members: WorkspaceTeamMemberOption[]
  initialTeam?: WorkspaceTeamSummary | null
  submitLabel?: string
  onCancel: () => void
  onSaved: (team: WorkspaceTeamSummary) => void
}) {
  const [name, setName] = useState(initialTeam?.name ?? '')
  const [description, setDescription] = useState(initialTeam?.description ?? '')
  const [teamType, setTeamType] = useState<WorkspaceTeamTypeValue>(
    initialTeam?.teamType ?? 'general',
  )
  const [leadMemberId, setLeadMemberId] = useState(
    initialTeam?.leadMemberId ?? '',
  )
  const [memberIds, setMemberIds] = useState<string[]>(
    initialTeam?.members.map((member) => member.workspaceMemberId) ?? [],
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const sortedMembers = useMemo(
    () =>
      [...members].sort((first, second) =>
        first.label.localeCompare(second.label),
      ),
    [members],
  )

  const toggleMember = (memberId: string) => {
    setMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(
        initialTeam
          ? `/api/workspaces/${workspaceId}/teams/${initialTeam.id}`
          : `/api/workspaces/${workspaceId}/teams`,
        {
          method: initialTeam ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team: {
              name,
              description,
              teamType,
              leadMemberId: leadMemberId || null,
              memberIds,
              isActive: true,
            },
          }),
        },
      )
      const data = (await response.json().catch(() => ({}))) as {
        team?: WorkspaceTeamSummary
      } & WorkspaceStructureApiError
      if (!response.ok || !data.team) {
        throw new Error(
          getWorkspaceStructureErrorMessage({
            data,
            fallback: 'Team could not be saved. Try again.',
          }),
        )
      }
      onSaved(data.team)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Team could not be saved.',
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
          Team name
        </span>
        <Input
          aria-label="Team name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Field Crew"
        />
      </label>
      <label className="space-y-1">
        <span className="text-neutral-text-secondary text-xs font-medium">
          Description
        </span>
        <Textarea
          aria-label="Team description"
          value={description ?? ''}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What this team handles"
          className="min-h-[80px]"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Team type
          </span>
          <Select
            aria-label="Team type"
            value={teamType}
            onChange={(event) =>
              setTeamType(event.target.value as WorkspaceTeamTypeValue)
            }
          >
            {workspaceTeamTypes.map((type) => (
              <option key={type} value={type}>
                {formatWorkspaceTeamType(type)}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-neutral-text-secondary text-xs font-medium">
            Team lead
          </span>
          <Select
            aria-label="Team lead"
            value={leadMemberId}
            onChange={(event) => setLeadMemberId(event.target.value)}
          >
            <option value="">No lead</option>
            {sortedMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="space-y-2">
        <p className="text-neutral-text-secondary text-xs font-medium">
          Members
        </p>
        <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          {sortedMembers.length ? (
            sortedMembers.map((member) => (
              <label
                key={member.id}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-neutral-100 hover:bg-slate-900"
              >
                <input
                  type="checkbox"
                  checked={memberIds.includes(member.id)}
                  onChange={() => toggleMember(member.id)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                />
                <span>
                  <span className="font-medium">{member.label}</span>
                  {member.email ? (
                    <span className="text-neutral-text-secondary ml-2 text-xs">
                      {member.email}
                    </span>
                  ) : null}
                </span>
              </label>
            ))
          ) : (
            <p className="text-neutral-text-secondary text-sm">
              No active workspace members are available.
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {submitLabel ?? (initialTeam ? 'Save Team' : 'Create Team')}
        </Button>
      </div>
    </form>
  )
}
