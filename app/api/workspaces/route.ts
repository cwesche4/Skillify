// app/api/workspaces/route.ts
import { prisma } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export async function GET() {
  const { userId: clerkId } = await auth()

  if (!clerkId) {
    return NextResponse.json({ data: [] }, { status: 200 })
  }

  const userProfile = await prisma.userProfile.findUnique({
    where: { clerkId },
    include: {
      ownedWorkspaces: true,
      memberships: { include: { workspace: true } },
    },
  })

  if (!userProfile) {
    return NextResponse.json({ data: [] }, { status: 200 })
  }

  const owned = userProfile.ownedWorkspaces.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
  }))

  const memberWorkspaces = userProfile.memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
  }))

  const map = new Map<string, { id: string; name: string; slug: string }>()
  ;[...owned, ...memberWorkspaces].forEach((w) => map.set(w.id, w))

  const data = Array.from(map.values())

  return NextResponse.json({ data })
}
