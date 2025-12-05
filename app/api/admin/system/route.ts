import { auth } from "@clerk/nextjs/server"

import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const { userId: clerkId } = auth()
    if (!clerkId) return new Response("Unauthorized", { status: 401 })

    // Get user
    const user = await prisma.userProfile.findUnique({
      where: { clerkId },
      include: { memberships: true },
    })

    if (!user) return new Response("User not found", { status: 404 })

    // Find user's active workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        members: {
          some: {
            userId: user.id,
            role: { in: ["OWNER", "ADMIN"] },
          },
        },
      },
    })

    if (!workspace) {
      return new Response("Not an admin of this workspace", { status: 403 })
    }

    const workspaceId = workspace.id

    // Fetch members
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
    })

    // Fetch invites
    const invites = await prisma.workspaceInvite.findMany({
      where: { workspaceId },
    })

    // Stats
    const [automations, runs] = await Promise.all([
      prisma.automation.count({ where: { workspaceId } }),
      prisma.automationRun.count({ where: { workspaceId } }),
    ])

    return Response.json({
      workspace,
      members,
      invites,
      stats: {
        members: members.length,
        invites: invites.length,
        automations,
        runs,
      },
    })
  } catch (error) {
    console.error("Admin system error:", error)
    return new Response("Server error", { status: 500 })
  }
}
