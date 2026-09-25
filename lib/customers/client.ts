import type {
  CustomerClientRecord,
  CustomerMutationInput,
} from '@/lib/customers/clientTypes'

type ErrorBody = {
  message?: string
  fieldErrors?: Record<string, string[] | undefined>
}

export class CustomersApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message)
    this.name = 'CustomersApiError'
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
  const body = (await response.json().catch(() => null)) as ErrorBody | null
  if (!response.ok) {
    throw new CustomersApiError(
      body?.message || 'The Customer request could not be completed.',
      response.status,
      body?.fieldErrors,
    )
  }
  return body as T
}

function customerPath(workspaceId: string, customerId?: string) {
  const base = `/api/workspaces/${encodeURIComponent(workspaceId)}/customers`
  return customerId ? `${base}/${encodeURIComponent(customerId)}` : base
}

export async function listCustomers(workspaceId: string, search = '') {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  const query = params.size ? `?${params.toString()}` : ''
  const body = await requestJson<{ customers: CustomerClientRecord[] }>(
    `${customerPath(workspaceId)}${query}`,
  )
  return body.customers
}

export async function createCustomer(
  workspaceId: string,
  input: CustomerMutationInput & { displayName: string },
) {
  const body = await requestJson<{ customer: CustomerClientRecord }>(
    customerPath(workspaceId),
    { method: 'POST', body: JSON.stringify(input) },
  )
  return body.customer
}

export async function updateCustomer(
  workspaceId: string,
  customerId: string,
  input: CustomerMutationInput,
) {
  const body = await requestJson<{ customer: CustomerClientRecord }>(
    customerPath(workspaceId, customerId),
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return body.customer
}

export async function archiveCustomer(workspaceId: string, customerId: string) {
  const body = await requestJson<{ customer: CustomerClientRecord }>(
    customerPath(workspaceId, customerId),
    { method: 'DELETE' },
  )
  return body.customer
}
