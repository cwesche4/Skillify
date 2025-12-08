import { auth, clerkClient } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  const exportPayload = {
    id: user.id,
    emailAddresses: user.emailAddresses,
    phoneNumbers: user.phoneNumbers,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    publicMetadata: user.publicMetadata,
    privateMetadata: user.privateMetadata,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }

  const body = JSON.stringify(exportPayload, null, 2)

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="my-skillify-data.json"',
    },
  })
}
