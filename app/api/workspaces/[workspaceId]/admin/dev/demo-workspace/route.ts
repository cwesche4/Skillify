import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { requireWorkspaceRole } from '@/lib/auth/requireWorkspaceRole'
import { prisma } from '@/lib/db'
import {
  DEMO_WORKSPACE_TIMEZONE,
  createDemoWorkspacePlan,
  getStoredDemoWorkspaceSummary,
  getDemoWorkspaceSummary,
  populateDemoWorkspace,
  resetDemoWorkspaceRecords,
  resolveDemoWorkspaceGenerationConfig,
} from '@/lib/dev/demoWorkspaceGenerator'
import { getWorkspaceDateKey } from '@/lib/scheduling/schedulingDateTime'
import {
  findAvailableWorkspaceSlug,
  isMachineGeneratedWorkspaceSlug,
} from '@/lib/workspaces/workspaceSlugs'

type Params = { params: { workspaceId: string } }

const operations = new Set([
  'generate',
  'reset',
  'regenerate',
  'summary',
  'dryRun',
  'regenerateSlug',
])

function devOnly() {
  return process.env.NODE_ENV !== 'production'
}

function safeError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

async function getAuthorizedWorkspace(workspaceId: string) {
  if (!devOnly()) return { error: safeError('Not found.', 404) }
  const guard = await requireWorkspaceRole(workspaceId, ['owner', 'admin'])
  if (!guard.allowed)
    return { error: safeError('Permission denied.', guard.status) }
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, archivedAt: null },
    select: { id: true, name: true, slug: true },
  })
  if (!workspace) return { error: safeError('Workspace not found.', 404) }
  return { workspace }
}

function revalidateWorkspaceRoutes(slug: string) {
  for (const path of [
    `/dashboard/${slug}`,
    `/dashboard/${slug}/scheduling`,
    `/dashboard/${slug}/scheduling/calendar`,
    `/dashboard/${slug}/scheduling/appointments`,
    `/dashboard/${slug}/scheduling/team-availability`,
    `/dashboard/${slug}/members`,
    `/dashboard/${slug}/settings`,
  ]) {
    revalidatePath(path)
  }
}

async function buildSummary(workspace: {
  id: string
  name: string
  slug: string
}) {
  const stored = await getStoredDemoWorkspaceSummary(workspace.id)
  const suggestedSlug = await findAvailableWorkspaceSlug({
    name: workspace.name,
    isAvailable: async (slug) => {
      if (slug === workspace.slug) return true
      const existing = await prisma.workspace.findUnique({ where: { slug } })
      return !existing
    },
  })

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      suggestedSlug,
      machineGeneratedSlug: isMachineGeneratedWorkspaceSlug(workspace.slug),
    },
    demo: stored,
  }
}

export async function GET(_request: Request, { params }: Params) {
  const authorized = await getAuthorizedWorkspace(params.workspaceId)
  if ('error' in authorized) return authorized.error
  return NextResponse.json({
    ok: true,
    ...(await buildSummary(authorized.workspace)),
  })
}

export async function POST(request: Request, { params }: Params) {
  const authorized = await getAuthorizedWorkspace(params.workspaceId)
  if ('error' in authorized) return authorized.error
  const { workspace } = authorized

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const operation =
    body && typeof body === 'object' && 'operation' in body
      ? String((body as { operation?: unknown }).operation)
      : ''
  if (!operations.has(operation)) {
    return safeError('Choose a supported development operation.')
  }

  try {
    if (operation === 'summary') {
      return NextResponse.json({
        ok: true,
        ...(await buildSummary(workspace)),
      })
    }

    if (operation === 'dryRun') {
      const timezone = readString(body, 'timezone') ?? DEMO_WORKSPACE_TIMEZONE
      const anchorDate =
        readString(body, 'anchorDate') ??
        getWorkspaceDateKey(new Date(), timezone)
      const config = resolveDemoWorkspaceGenerationConfig(readConfig(body))
      const plan = createDemoWorkspacePlan({
        workspaceId: workspace.id,
        anchorDate,
        timezone,
        config,
      })
      return NextResponse.json({
        ok: true,
        operation,
        dryRun: true,
        plannedSummary: getDemoWorkspaceSummary(plan),
        resolvedConfig: config,
        ...(await buildSummary(workspace)),
      })
    }

    if (operation === 'reset') {
      const deleted = await resetDemoWorkspaceRecords(workspace.id)
      revalidateWorkspaceRoutes(workspace.slug)
      return NextResponse.json({
        ok: true,
        operation,
        deleted,
        ...(await buildSummary(workspace)),
      })
    }

    if (operation === 'generate' || operation === 'regenerate') {
      const timezone = readString(body, 'timezone') ?? DEMO_WORKSPACE_TIMEZONE
      const anchorDate =
        body &&
        typeof body === 'object' &&
        typeof (body as { anchorDate?: unknown }).anchorDate === 'string'
          ? (body as { anchorDate: string }).anchorDate
          : getWorkspaceDateKey(new Date(), timezone)
      const config = resolveDemoWorkspaceGenerationConfig(readConfig(body))
      const result = await populateDemoWorkspace({
        workspaceId: workspace.id,
        anchorDate,
        timezone,
        config,
      })
      revalidateWorkspaceRoutes(workspace.slug)
      return NextResponse.json({
        ok: true,
        operation,
        summary: result.summary,
        ...(await buildSummary(workspace)),
      })
    }

    if (operation === 'regenerateSlug') {
      const nextSlug = await findAvailableWorkspaceSlug({
        name: workspace.name,
        isAvailable: async (slug) => {
          if (slug === workspace.slug) return true
          const existing = await prisma.workspace.findUnique({
            where: { slug },
          })
          return !existing
        },
      })
      const oldSlug = workspace.slug
      const updated = await prisma.workspace.update({
        where: { id: workspace.id },
        data: { slug: nextSlug },
        select: { id: true, name: true, slug: true },
      })
      revalidateWorkspaceRoutes(oldSlug)
      revalidateWorkspaceRoutes(updated.slug)
      return NextResponse.json({
        ok: true,
        operation,
        oldSlug,
        newSlug: updated.slug,
        canonicalPath: `/dashboard/${updated.slug}/admin/dev-tools`,
        workspace: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          suggestedSlug: updated.slug,
          machineGeneratedSlug: isMachineGeneratedWorkspaceSlug(updated.slug),
        },
        demo: await getStoredDemoWorkspaceSummary(updated.id),
      })
    }
  } catch (error) {
    console.error('[dev-demo-workspace]', error)
    return safeError('The development operation could not be completed.', 500)
  }

  return safeError('Choose a supported development operation.')
}

function readConfig(body: unknown) {
  if (!body || typeof body !== 'object' || !('config' in body)) return undefined
  return (body as { config?: unknown }).config &&
    typeof (body as { config?: unknown }).config === 'object'
    ? (body as { config: Record<string, unknown> }).config
    : undefined
}

function readString(body: unknown, key: string) {
  if (!body || typeof body !== 'object') return undefined
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
