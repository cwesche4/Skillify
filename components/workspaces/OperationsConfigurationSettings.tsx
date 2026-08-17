'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import type { WorkspaceClient } from '@/lib/clients/types'
import { getClientTagUsageMap } from '@/lib/clients/clientTagRegistry'
import {
  archivePreviewClientTag,
  createPreviewClientTag,
  getPreviewClientTags,
  renamePreviewClientTag,
  restorePreviewClientTag,
} from '@/lib/clients/previewClientTagStorage'
import type { WorkspaceServiceRequest } from '@/lib/service-requests/types'
import { getServiceRequestTypeUsageMap } from '@/lib/service-requests/serviceRequestTypeRegistry'
import {
  archivePreviewServiceRequestType,
  createPreviewServiceRequestType,
  getPreviewServiceRequestTypes,
  renamePreviewServiceRequestType,
  restorePreviewServiceRequestType,
} from '@/lib/service-requests/previewServiceRequestTypeStorage'
import type { WorkspaceRecordTerminology } from '@/lib/workspaces/workspacePresentation'

export function OperationsConfigurationSettings({
  workspaceId,
  clients,
  serviceRequests,
  terminology,
  canEdit,
}: {
  workspaceId: string
  clients: WorkspaceClient[]
  serviceRequests: WorkspaceServiceRequest[]
  terminology: WorkspaceRecordTerminology
  canEdit: boolean
}) {
  const [jobTypes, setJobTypes] = useState(() =>
    getPreviewServiceRequestTypes(workspaceId),
  )
  const [customerTags, setCustomerTags] = useState(() =>
    getPreviewClientTags(workspaceId),
  )
  const [jobTypeLabel, setJobTypeLabel] = useState('')
  const [customerTagLabel, setCustomerTagLabel] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const jobTypeUsage = useMemo(
    () => getServiceRequestTypeUsageMap(jobTypes, serviceRequests),
    [jobTypes, serviceRequests],
  )
  const tagUsage = useMemo(
    () => getClientTagUsageMap(customerTags, clients),
    [clients, customerTags],
  )

  const refreshJobTypes = () => {
    setJobTypes(getPreviewServiceRequestTypes(workspaceId))
  }

  const refreshCustomerTags = () => {
    setCustomerTags(getPreviewClientTags(workspaceId))
  }

  const createJobType = () => {
    const result = createPreviewServiceRequestType({
      workspaceId,
      label: jobTypeLabel,
    })
    if (!result.type) {
      setError(result.errors.label ?? 'Job type could not be created.')
      return
    }
    setError(null)
    setJobTypeLabel('')
    refreshJobTypes()
    setMessage(`${terminology.serviceRequestSingular} type created.`)
  }

  const createCustomerTag = () => {
    const result = createPreviewClientTag({
      workspaceId,
      label: customerTagLabel,
    })
    if (!result.tag) {
      setError(result.errors.label ?? 'Customer tag could not be created.')
      return
    }
    setError(null)
    setCustomerTagLabel('')
    refreshCustomerTags()
    setMessage(`${terminology.customerSingular} tag created.`)
  }

  return (
    <Card className="space-y-4 p-5 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Operations Configuration</h2>
          <p className="text-neutral-text-secondary mt-1 text-xs">
            Configure workspace-owned{' '}
            {terminology.serviceRequestPlural.toLowerCase()} types and reusable{' '}
            {terminology.customerSingular.toLowerCase()} tags.
          </p>
        </div>
        <Badge variant="slate">Workspace scoped</Badge>
      </div>
      {message ? (
        <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-2 text-xs text-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <ConfigurationList
          title={`${terminology.serviceRequestSingular} Types`}
          description={`Reusable labels for classifying ${terminology.serviceRequestPlural.toLowerCase()}.`}
          inputLabel={`New ${terminology.serviceRequestSingular.toLowerCase()} type`}
          inputValue={jobTypeLabel}
          inputPlaceholder="Service Call, Repair, Maintenance..."
          canEdit={canEdit}
          onInputChange={setJobTypeLabel}
          onCreate={createJobType}
          rows={jobTypes}
          usage={jobTypeUsage}
          onRename={(id, currentLabel) => {
            const nextLabel = window.prompt('Rename job type', currentLabel)
            if (nextLabel === null) return
            const result = renamePreviewServiceRequestType({
              workspaceId,
              typeId: id,
              label: nextLabel,
            })
            if (!result.type)
              setError(
                result.errors.label ??
                  result.errors.type ??
                  'Job type could not be renamed.',
              )
            else {
              setError(null)
              refreshJobTypes()
            }
          }}
          onArchive={(id) => {
            archivePreviewServiceRequestType({ workspaceId, typeId: id })
            refreshJobTypes()
          }}
          onRestore={(id) => {
            restorePreviewServiceRequestType({ workspaceId, typeId: id })
            refreshJobTypes()
          }}
        />
        <ConfigurationList
          title={`${terminology.customerSingular} Tags`}
          description={`Reusable workspace tags for segmenting ${terminology.customerPlural.toLowerCase()}.`}
          inputLabel={`New ${terminology.customerSingular.toLowerCase()} tag`}
          inputValue={customerTagLabel}
          inputPlaceholder="VIP, Recurring, Needs Follow-Up..."
          canEdit={canEdit}
          onInputChange={setCustomerTagLabel}
          onCreate={createCustomerTag}
          rows={customerTags}
          usage={tagUsage}
          onRename={(id, currentLabel) => {
            const nextLabel = window.prompt('Rename customer tag', currentLabel)
            if (nextLabel === null) return
            const result = renamePreviewClientTag({
              workspaceId,
              tagId: id,
              label: nextLabel,
            })
            if (!result.tag)
              setError(
                result.errors.label ??
                  result.errors.tag ??
                  'Customer tag could not be renamed.',
              )
            else {
              setError(null)
              refreshCustomerTags()
            }
          }}
          onArchive={(id) => {
            archivePreviewClientTag({ workspaceId, tagId: id })
            refreshCustomerTags()
          }}
          onRestore={(id) => {
            restorePreviewClientTag({ workspaceId, tagId: id })
            refreshCustomerTags()
          }}
        />
      </div>
    </Card>
  )
}

function ConfigurationList({
  title,
  description,
  inputLabel,
  inputValue,
  inputPlaceholder,
  canEdit,
  onInputChange,
  onCreate,
  rows,
  usage,
  onRename,
  onArchive,
  onRestore,
}: {
  title: string
  description: string
  inputLabel: string
  inputValue: string
  inputPlaceholder: string
  canEdit: boolean
  onInputChange: (value: string) => void
  onCreate: () => void
  rows: Array<{ id: string; label: string; status: 'active' | 'archived' }>
  usage: Map<string, number>
  onRename: (id: string, currentLabel: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
}) {
  return (
    <section className="app-panel-muted rounded-2xl p-4">
      <h3 className="text-app-primary text-sm font-semibold">{title}</h3>
      <p className="text-neutral-text-secondary mt-1 text-xs leading-5">
        {description}
      </p>
      {canEdit ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={inputPlaceholder}
            aria-label={inputLabel}
          />
          <Button
            type="button"
            onClick={onCreate}
            leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Add
          </Button>
        </div>
      ) : null}
      <div className="mt-4 space-y-2">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="app-option-card flex flex-wrap items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-app-primary truncate text-sm font-medium">
                  {row.label}
                </p>
                <p className="text-neutral-text-secondary mt-0.5 text-[11px]">
                  {usage.get(row.id) ?? 0} assigned · {row.status}
                </p>
              </div>
              {canEdit ? (
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => onRename(row.id, row.label)}
                  >
                    Rename
                  </Button>
                  {row.status === 'active' ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => onArchive(row.id)}
                    >
                      Archive
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => onRestore(row.id)}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="border-app bg-app-surface-raised text-neutral-text-secondary rounded-xl border border-dashed p-3 text-sm">
            No options configured yet.
          </p>
        )}
      </div>
    </section>
  )
}
