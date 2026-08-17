import { Prisma } from '@prisma/client'

export const WORKSPACE_SLUG_MAX_LENGTH = 48

export const reservedWorkspaceSlugs = new Set([
  'admin',
  'api',
  'settings',
  'new',
  'create',
  'login',
  'signup',
  'sign-in',
  'sign-up',
  'dashboard',
])

export function normalizeWorkspaceSlugBase(input: string) {
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, WORKSPACE_SLUG_MAX_LENGTH)
    .replace(/-+$/g, '')

  const base = normalized || 'workspace'
  return reservedWorkspaceSlugs.has(base) ? `${base}-workspace` : base
}

export function getWorkspaceSlugCandidate(name: string, attempt: number) {
  const base = normalizeWorkspaceSlugBase(name)
  if (attempt <= 0) return base
  const suffix = `-${attempt + 1}`
  return `${base.slice(0, WORKSPACE_SLUG_MAX_LENGTH - suffix.length).replace(/-+$/g, '')}${suffix}`
}

export function isMachineGeneratedWorkspaceSlug(slug: string) {
  return /^workspace-(?:c[a-z0-9]{20,}|user_[a-z0-9]+|[a-z0-9_-]{12,})$/i.test(
    slug,
  )
}

export function isPrismaUniqueConstraintError(error: unknown, field?: string) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== 'P2002') return false
  if (!field) return true
  const target = error.meta?.target
  return Array.isArray(target) ? target.includes(field) : target === field
}

export async function findAvailableWorkspaceSlug({
  name,
  isAvailable,
  maxAttempts = 25,
}: {
  name: string
  isAvailable: (slug: string) => Promise<boolean>
  maxAttempts?: number
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const slug = getWorkspaceSlugCandidate(name, attempt)
    if (await isAvailable(slug)) return slug
  }
  throw new Error('Could not generate a unique workspace slug.')
}
