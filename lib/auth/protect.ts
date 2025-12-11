// lib/auth/protect.ts
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

// Plan ranking
const PLAN_RANK = {
  Free: 0,
  Basic: 1,
  Pro: 2,
  Elite: 3,
} as const

type Plan = keyof typeof PLAN_RANK
type Role = 'owner' | 'admin' | 'member'

export async function requireAuth() {
  const { userId } = auth()
  if (!userId) return { ok: false, reason: 'UNAUTHORIZED' }
  return { ok: true, userId }
}

export async function getWorkspace(workspaceSlug: string) {
  return prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
  })
}

export async function getUserRole(userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { user: { clerkId: userId }, workspaceId },
  })
  return membership?.role?.toLowerCase() as Role | null
}

export async function getUserPlan(userId: string): Promise<Plan> {
  const sub = await prisma.subscription.findFirst({
    where: { userId },
  })
  return (sub?.plan as Plan) ?? 'Free'
}

/* ---------------------------
   ROLE GUARD
---------------------------- */
export function requireRole(role: Role | Role[], userRole: Role | null) {
  const roles = Array.isArray(role) ? role : [role]
  return !!(userRole && roles.includes(userRole))
}

/* ---------------------------
   PLAN GUARD
---------------------------- */
export function requirePlan(required: Plan, actual: Plan) {
  return PLAN_RANK[actual] >= PLAN_RANK[required]
}

/* ---------------------------
   MASTER GUARD
---------------------------- */
export async function protectRoute(
  workspaceSlug: string,
  rules?: {
    require?: Plan
    role?: Role | Role[]
  },
) {
  // 1. User authenticated
  const { ok, userId } = await requireAuth()
  if (!ok || !userId) return { allowed: false, redirect: '/sign-in' }

  // 2. Workspace exists
  const workspace = await getWorkspace(workspaceSlug)
  if (!workspace)
    return { allowed: false, redirect: '/onboarding/create-workspace' }

  // 3. User's role in this workspace
  const role = await getUserRole(userId, workspace.id)
  if (!role) return { allowed: false, redirect: '/dashboard' }

  // 4. User's subscription tier
  const plan = await getUserPlan(userId)

  // 5. Role requirement?
  if (rules?.role && !requireRole(rules.role, role)) {
    return { allowed: false, redirect: `/dashboard/${workspaceSlug}` }
  }

  // 6. Plan requirement?
  if (rules?.require && !requirePlan(rules.require, plan)) {
    return { allowed: false, redirect: `/dashboard/${workspaceSlug}/upsell` }
  }

  return {
    allowed: true,
    workspace,
    role,
    plan,
    userId,
  }
}
