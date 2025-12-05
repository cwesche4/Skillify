import { auth, clerkClient } from "@clerk/nextjs/server"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url))
  }

  const formData = await req.formData()
  const fullName = (formData.get("fullName") || "").toString().trim()
  const username = (formData.get("username") || "").toString().trim()

  let firstName: string | undefined
  let lastName: string | undefined

  if (fullName) {
    const parts = fullName.split(" ").filter(Boolean)
    firstName = parts[0]
    lastName = parts.slice(1).join(" ") || undefined
  }

  const client = await clerkClient()
  await client.users.updateUser(userId, {
    firstName,
    lastName,
    username: username || undefined,
  })

  return NextResponse.redirect(new URL("/settings", req.url))
}
