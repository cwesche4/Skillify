import { NextResponse } from 'next/server'

import {
  authorizeCustomerRequest,
  customerApiError,
  customerAuthorizationError,
  readCustomerJson,
} from '@/lib/customers/api'
import { customerService } from '@/lib/customers/defaultService'

type RouteContext = { params: { workspaceId: string } }

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await authorizeCustomerRequest(params.workspaceId)
  if (!authorization.allowed) {
    return customerAuthorizationError(authorization)
  }

  try {
    const search = new URL(request.url).searchParams.get('search') ?? undefined
    const customers = await customerService.listCustomers(params.workspaceId, {
      search,
    })
    return NextResponse.json({ ok: true, customers })
  } catch (error) {
    return customerApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await authorizeCustomerRequest(params.workspaceId)
  if (!authorization.allowed) {
    return customerAuthorizationError(authorization)
  }

  try {
    const input = await readCustomerJson(request)
    const customer = await customerService.createCustomer(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      input,
    )
    return NextResponse.json({ ok: true, customer }, { status: 201 })
  } catch (error) {
    return customerApiError(error)
  }
}
