'use client'

import { useEffect, useState } from 'react'
import { Edit3, RotateCcw, Users } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  formatWorkspaceTeamType,
  WorkspaceTeamForm,
  type WorkspaceTeamMemberOption,
} from '@/components/workspace-structure/WorkspaceTeamForm'
import type { WorkspaceTeamSummary } from '@/lib/workspaceStructure/types'
import {
  getWorkspaceStructureErrorMessage,
  type WorkspaceStructureApiError,
} from './workspaceStructureClientErrors'

export function WorkspaceTeamsPanel({
  workspaceId,
  members,
  canManage,
}: {
  workspaceId: string
  members: WorkspaceTeamMemberOption[]
  canManage: boolean
}) {
  const [teams, setTeams] = useState<WorkspaceTeamSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [editingTeam, setEditingTeam] = useState<WorkspaceTeamSummary | null>(
    null,
  )
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const loadTeams = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/teams?includeArchived=${showArchived}`,
        { cache: 'no-store' },
      )
      const data = (await response.json().catch(() => ({}))) as {
        teams?: WorkspaceTeamSummary[]
      } & WorkspaceStructureApiError
      if (!response.ok) {
        throw new Error(
          getWorkspaceStructureErrorMessage({
            data,
            fallback: 'Teams could not be loaded. Try again.',
          }),
        )
      }
      setTeams(data.teams ?? [])
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Teams could not be loaded. Try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTeams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, showArchived])

  const archiveTeam = async (team: WorkspaceTeamSummary) => {
    await fetch(`/api/workspaces/${workspaceId}/teams/${team.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: team.archivedAt ? 'restore' : 'archive' }),
    })
    await loadTeams()
  }

  const filteredTeams = teams.filter((team) =>
    [team.name, team.description, team.teamType]
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-50">Teams</h2>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            Create stable workspace teams for scheduling, assignment, and
            Working Hours.
          </p>
        </div>
        {canManage ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCreating(true)}
          >
            Create Team
          </Button>
        ) : null}
      </div>

      {creating || editingTeam ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <WorkspaceTeamForm
            workspaceId={workspaceId}
            members={members}
            initialTeam={editingTeam}
            onCancel={() => {
              setCreating(false)
              setEditingTeam(null)
            }}
            onSaved={(team) => {
              setTeams((current) => [
                team,
                ...current.filter((item) => item.id !== team.id),
              ])
              setCreating(false)
              setEditingTeam(null)
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Search teams"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search teams"
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

      {error && !creating && !editingTeam ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/[0.08] p-3 text-sm text-rose-100">
          <p>{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={loadTeams}>
            Retry
          </Button>
        </div>
      ) : null}
      {loading ? (
        <p className="text-neutral-text-secondary text-sm">Loading teams...</p>
      ) : filteredTeams.length ? (
        <div className="space-y-2">
          {filteredTeams.map((team) => (
            <div
              key={team.id}
              className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-neutral-50">{team.name}</p>
                    <Badge variant={team.archivedAt ? 'default' : 'blue'}>
                      {team.archivedAt ? 'Archived' : 'Active'}
                    </Badge>
                  </div>
                  <p className="text-neutral-text-secondary mt-1 text-xs">
                    {formatWorkspaceTeamType(team.teamType)} ·{' '}
                    {team.members.length} member
                    {team.members.length === 1 ? '' : 's'}
                  </p>
                  {team.description ? (
                    <p className="text-neutral-text-secondary mt-2 text-sm">
                      {team.description}
                    </p>
                  ) : null}
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      leftIcon={<Edit3 className="h-3.5 w-3.5" />}
                      onClick={() => setEditingTeam(team)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      leftIcon={
                        team.archivedAt ? (
                          <RotateCcw className="h-3.5 w-3.5" />
                        ) : (
                          <Users className="h-3.5 w-3.5" />
                        )
                      }
                      onClick={() => archiveTeam(team)}
                    >
                      {team.archivedAt ? 'Restore' : 'Archive'}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
          <p className="font-medium text-neutral-100">No teams yet.</p>
          <p className="text-neutral-text-secondary mt-1 text-sm">
            Create Team to configure Team Hours and prepare team assignments.
          </p>
        </div>
      )}
    </Card>
  )
}
