import type {
  JobClientRecord,
  JobMutationInput,
  JobStepMutationInput,
  WorkItemClientRecord,
} from '@/lib/jobs/clientTypes'

export class JobsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'JobsApiError'
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const body = (await response.json().catch(() => null)) as {
    message?: string
  } | null
  if (!response.ok) {
    throw new JobsApiError(
      body?.message || 'The Jobs request could not be completed.',
      response.status,
    )
  }
  return body as T
}

function workspacePath(workspaceId: string) {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}`
}

export async function listJobs(
  workspaceId: string,
  filters: { customerId?: string } = {},
) {
  const params = new URLSearchParams()
  if (filters.customerId) params.set('customerId', filters.customerId)
  const query = params.size ? `?${params.toString()}` : ''
  const body = await requestJson<{ jobs: JobClientRecord[] }>(
    `${workspacePath(workspaceId)}/jobs${query}`,
  )
  return body.jobs
}

export async function createJob(
  workspaceId: string,
  input: JobMutationInput & { title: string },
) {
  const body = await requestJson<{ job: JobClientRecord }>(
    `${workspacePath(workspaceId)}/jobs`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  return body.job
}

export async function updateJob(
  workspaceId: string,
  jobId: string,
  input: JobMutationInput,
) {
  const body = await requestJson<{ job: JobClientRecord }>(
    `${workspacePath(workspaceId)}/jobs/${encodeURIComponent(jobId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return body.job
}

export async function archiveJob(workspaceId: string, jobId: string) {
  await requestJson<{ job: JobClientRecord }>(
    `${workspacePath(workspaceId)}/jobs/${encodeURIComponent(jobId)}`,
    { method: 'DELETE' },
  )
}

export async function listJobSteps(workspaceId: string, jobId: string) {
  const body = await requestJson<{ workItems: WorkItemClientRecord[] }>(
    `${workspacePath(workspaceId)}/jobs/${encodeURIComponent(jobId)}/work-items`,
  )
  return body.workItems
}

export async function createJobStep(
  workspaceId: string,
  jobId: string,
  input: JobStepMutationInput & { title: string },
) {
  const body = await requestJson<{ workItem: WorkItemClientRecord }>(
    `${workspacePath(workspaceId)}/jobs/${encodeURIComponent(jobId)}/work-items`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  return body.workItem
}

export async function updateJobStep(
  workspaceId: string,
  workItemId: string,
  input: JobStepMutationInput,
) {
  const body = await requestJson<{ workItem: WorkItemClientRecord }>(
    `${workspacePath(workspaceId)}/work-items/${encodeURIComponent(workItemId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return body.workItem
}

export async function archiveJobStep(workspaceId: string, workItemId: string) {
  await requestJson<{ workItem: WorkItemClientRecord }>(
    `${workspacePath(workspaceId)}/work-items/${encodeURIComponent(workItemId)}`,
    { method: 'DELETE' },
  )
}

export async function listTodos(workspaceId: string) {
  const body = await requestJson<{ workItems: WorkItemClientRecord[] }>(
    `${workspacePath(workspaceId)}/work-items?kind=TODO`,
  )
  return body.workItems
}

export async function createTodo(
  workspaceId: string,
  input: JobStepMutationInput & { title: string },
) {
  const body = await requestJson<{ workItem: WorkItemClientRecord }>(
    `${workspacePath(workspaceId)}/work-items`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  return body.workItem
}

export async function updateTodo(
  workspaceId: string,
  workItemId: string,
  input: JobStepMutationInput,
) {
  return updateJobStep(workspaceId, workItemId, input)
}

export async function archiveTodo(workspaceId: string, workItemId: string) {
  return archiveJobStep(workspaceId, workItemId)
}
