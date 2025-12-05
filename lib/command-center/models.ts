// lib/command-center/models.ts
import { prisma } from "@/lib/db"

/* ============================================================
   TYPES
============================================================ */
export interface AutomationSearchResult {
  id: string
  name: string
  status: string
}

export interface WorkspaceSearchResult {
  id: string
  name: string
  slug: string
}

export interface MemberSearchResult {
  id: string
  user: {
    id: string
    clerkId: string | null
  }
}

/* ============================================================
   SEARCH: AUTOMATIONS
============================================================ */
export async function searchAutomations(
  workspaceId: string,
  query: string,
): Promise<AutomationSearchResult[]> {
  return prisma.automation.findMany({
    where: {
      workspaceId,
      name: { contains: query, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
    take: 10,
  })
}

/* ============================================================
   SEARCH: WORKSPACES
============================================================ */
export async function searchWorkspaces(
  userId: string,
  query: string,
): Promise<WorkspaceSearchResult[]> {
  return prisma.workspace.findMany({
    where: {
      members: { some: { userId } },
      name: { contains: query, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
    take: 10,
  })
}

/* ============================================================
   SEARCH: MEMBERS
============================================================ */
export async function searchMembers(
  workspaceId: string,
  query: string,
): Promise<MemberSearchResult[]> {
  return prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      user: {
        OR: [{ clerkId: { contains: query, mode: "insensitive" } }],
      },
    },
    include: { user: true },
    take: 10,
  })
}

/* ============================================================
   STATIC COMMAND ACTIONS
============================================================ */
export const COMMAND_ACTIONS = [
  {
    id: "new_automation",
    label: "Create new automation",
    route: "/dashboard/automations",
  },
  {
    id: "open_analytics",
    label: "Open analytics dashboard",
    route: "/dashboard/analytics",
  },
  {
    id: "open_settings",
    label: "Open workspace settings",
    route: "/dashboard/settings",
  },
  {
    id: "invite_member",
    label: "Invite workspace member",
    route: "/dashboard/workspaces",
  },
]

/* ============================================================
   STATIC HELP ARTICLES
============================================================ */
export const HELP_ARTICLES = [
  {
    id: "optimizing-flows",
    title: "How to optimize slow automations",
    tags: ["performance", "flows"],
  },
  {
    id: "ai-coach",
    title: "How AI Coach guides your automations",
    tags: ["ai", "coach"],
  },
  {
    id: "analytics",
    title: "Understanding analytics & cost metrics",
    tags: ["analytics"],
  },
]
