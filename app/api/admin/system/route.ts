// app/api/admin/system/route.ts

import { prisma } from '@/lib/db'
import { getGlobalAdminProfile } from '@/lib/auth/getGlobalAdminProfile'

export async function GET() {
  try {
    const admin = await getGlobalAdminProfile()

    if (!admin) {
      return new Response('Forbidden', { status: 403 })
    }

    const workspace = admin.firstWorkspace
    if (!workspace) {
      return Response.json({
        workspace: null,
        members: [],
        invites: [],
        stats: {
          members: 0,
          invites: 0,
          automations: 0,
          runs: 0,
        },
      })
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
    console.error('Admin system error:', error)
    return new Response('Server error', { status: 500 })
  }
}
