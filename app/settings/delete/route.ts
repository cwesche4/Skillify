import { auth, clerkClient } from "@clerk/nextjs/server"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { userId, sessionClaims } = await auth()

  const role = (sessionClaims?.publicMetadata as any)?.role

  // Only admins can delete accounts (and only their own here)
  if (!userId || role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  const client = await clerkClient()
  await client.users.deleteUser(userId)

  // After deleting their account, send them to homepage
  return NextResponse.redirect(new URL("/", req.url))
}
