import { NextResponse } from 'next/server'

import {
  authorizeCustomerRequest,
  customerApiError,
  customerAuthorizationError,
  readCustomerJson,
} from '@/lib/customers/api'
import { customerService } from '@/lib/customers/defaultService'

type RouteContext = {
  params: { workspaceId: string; customerId: string }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeCustomerRequest(params.workspaceId)
  if (!authorization.allowed) {
    return customerAuthorizationError(authorization)
  }

  try {
    const customer = await customerService.getCustomer(
      params.workspaceId,
      params.customerId,
    )
    if (!customer) {
      return NextResponse.json(
        { ok: false, code: 'NOT_FOUND', message: 'Customer not found.' },
        { status: 404 },
      )
    }
    return NextResponse.json({ ok: true, customer })
  } catch (error) {
    return customerApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await authorizeCustomerRequest(params.workspaceId)
  if (!authorization.allowed) {
    return customerAuthorizationError(authorization)
  }

  try {
    const input = await readCustomerJson(request)
    const customer = await customerService.updateCustomer(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      params.customerId,
      input,
    )
    return NextResponse.json({ ok: true, customer })
  } catch (error) {
    return customerApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authorization = await authorizeCustomerRequest(params.workspaceId)
  if (!authorization.allowed) {
    return customerAuthorizationError(authorization)
  }

  try {
    const customer = await customerService.archiveCustomer(
      {
        workspaceId: params.workspaceId,
        userProfileId: authorization.userProfileId,
      },
      params.customerId,
    )
    return NextResponse.json({ ok: true, customer })
  } catch (error) {
    return customerApiError(error)
  }
}
