import { prisma } from '@/lib/db'
import { isSupportedSchedulingTimezone } from '@/lib/scheduling/schedulingTimezones'
import {
  workspaceLocationTypes,
  type WorkspaceLocationSummary,
  type WorkspaceLocationTypeValue,
} from '@/lib/workspaceStructure/types'
import type { WorkspaceStructureActor } from '@/lib/workspaceStructure/teams'

export class WorkspaceLocationError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'WorkspaceLocationError'
  }
}

export type WorkspaceLocationInput = {
  name?: string | null
  locationType?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  countryCode?: string | null
  timezone?: string | null
  phone?: string | null
  notes?: string | null
  isPrimary?: boolean | null
  isActive?: boolean | null
}

const prismaLocationTypeByValue: Record<WorkspaceLocationTypeValue, string> = {
  office: 'OFFICE',
  store: 'STORE',
  warehouse: 'WAREHOUSE',
  shop: 'SHOP',
  serviceBase: 'SERVICE_BASE',
  branch: 'BRANCH',
  remote: 'REMOTE',
  other: 'OTHER',
}

const locationTypeByPrismaValue = Object.fromEntries(
  Object.entries(prismaLocationTypeByValue).map(([key, value]) => [value, key]),
) as Record<string, WorkspaceLocationTypeValue>

function requireManager(actor: WorkspaceStructureActor) {
  if (!actor.canManageWorkspace) {
    throw new WorkspaceLocationError(
      'You do not have permission to manage workspace locations.',
      403,
    )
  }
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/\s+/g, ' ') ?? ''
  return trimmed || null
}

function normalizeName(value: string | null | undefined) {
  return normalizeText(value) ?? ''
}

function normalizeLocationType(value: string | null | undefined) {
  if (!value) return null
  return workspaceLocationTypes.includes(value as WorkspaceLocationTypeValue)
    ? (value as WorkspaceLocationTypeValue)
    : null
}

function serializeLocation(location: any): WorkspaceLocationSummary {
  return {
    id: location.id,
    workspaceId: location.workspaceId,
    name: location.name,
    locationType:
      locationTypeByPrismaValue[String(location.locationType)] ?? 'other',
    addressLine1: location.addressLine1,
    addressLine2: location.addressLine2,
    city: location.city,
    region: location.region,
    postalCode: location.postalCode,
    countryCode: location.countryCode,
    timezone: location.timezone,
    phone: location.phone,
    notes: location.notes,
    isPrimary: Boolean(location.isPrimary),
    isActive: Boolean(location.isActive) && !location.archivedAt,
    archivedAt: location.archivedAt
      ? new Date(location.archivedAt).toISOString()
      : null,
    createdAt: new Date(location.createdAt).toISOString(),
    updatedAt: new Date(location.updatedAt).toISOString(),
  }
}

async function assertUniqueActiveLocationName({
  workspaceId,
  name,
  exceptLocationId,
}: {
  workspaceId: string
  name: string
  exceptLocationId?: string
}) {
  const existing = await (prisma as any).workspaceLocation.findFirst({
    where: {
      workspaceId,
      name: { equals: name, mode: 'insensitive' },
      archivedAt: null,
      ...(exceptLocationId ? { id: { not: exceptLocationId } } : {}),
    },
    select: { id: true },
  })
  if (existing) {
    throw new WorkspaceLocationError(
      'A business location with this name already exists.',
      400,
      { name: 'A business location with this name already exists.' },
    )
  }
}

function normalizeLocationInput(input: WorkspaceLocationInput) {
  const name = normalizeName(input.name)
  if (name.length < 2) {
    throw new WorkspaceLocationError('Location name is required.', 400, {
      name: 'Location name is required.',
    })
  }
  const locationType = normalizeLocationType(input.locationType)
  if (!locationType) {
    throw new WorkspaceLocationError('Choose a location type.', 400, {
      locationType: 'Choose a location type.',
    })
  }
  const timezone = normalizeText(input.timezone)
  if (timezone && !isSupportedSchedulingTimezone(timezone)) {
    throw new WorkspaceLocationError('Choose a valid timezone.', 400, {
      timezone: 'Choose a valid IANA timezone.',
    })
  }
  return {
    name,
    locationType,
    addressLine1: normalizeText(input.addressLine1),
    addressLine2: normalizeText(input.addressLine2),
    city: normalizeText(input.city),
    region: normalizeText(input.region),
    postalCode: normalizeText(input.postalCode),
    countryCode: normalizeText(input.countryCode)?.toUpperCase() ?? null,
    timezone,
    phone: normalizeText(input.phone),
    notes: input.notes?.trim() || null,
    isPrimary: Boolean(input.isPrimary),
    isActive: input.isActive ?? true,
  }
}

export async function listWorkspaceLocations({
  workspaceId,
  includeArchived = false,
}: {
  workspaceId: string
  includeArchived?: boolean
}) {
  const locations = await (prisma as any).workspaceLocation.findMany({
    where: {
      workspaceId,
      ...(includeArchived ? {} : { archivedAt: null, isActive: true }),
    },
    orderBy: [{ archivedAt: 'asc' }, { isPrimary: 'desc' }, { name: 'asc' }],
  })
  return locations.map(serializeLocation)
}

export async function createWorkspaceLocation({
  actor,
  input,
}: {
  actor: WorkspaceStructureActor
  input: WorkspaceLocationInput
}) {
  requireManager(actor)
  const normalized = normalizeLocationInput(input)
  await assertUniqueActiveLocationName({
    workspaceId: actor.workspaceId,
    name: normalized.name,
  })
  const location = await prisma.$transaction(async (tx) => {
    if (normalized.isPrimary && normalized.isActive) {
      await (tx as any).workspaceLocation.updateMany({
        where: { workspaceId: actor.workspaceId, archivedAt: null },
        data: { isPrimary: false },
      })
    }
    return (tx as any).workspaceLocation.create({
      data: {
        workspaceId: actor.workspaceId,
        ...normalized,
        locationType: prismaLocationTypeByValue[normalized.locationType],
        archivedAt: normalized.isActive ? null : new Date(),
        isPrimary: normalized.isActive ? normalized.isPrimary : false,
        createdById: actor.actorUserId,
      },
    })
  })
  return serializeLocation(location)
}

export async function updateWorkspaceLocation({
  actor,
  locationId,
  input,
}: {
  actor: WorkspaceStructureActor
  locationId: string
  input: WorkspaceLocationInput
}) {
  requireManager(actor)
  const existing = await (prisma as any).workspaceLocation.findFirst({
    where: { id: locationId, workspaceId: actor.workspaceId },
    select: { id: true },
  })
  if (!existing) throw new WorkspaceLocationError('Location not found.', 404)
  const normalized = normalizeLocationInput(input)
  await assertUniqueActiveLocationName({
    workspaceId: actor.workspaceId,
    name: normalized.name,
    exceptLocationId: locationId,
  })
  const location = await prisma.$transaction(async (tx) => {
    if (normalized.isPrimary && normalized.isActive) {
      await (tx as any).workspaceLocation.updateMany({
        where: {
          workspaceId: actor.workspaceId,
          archivedAt: null,
          id: { not: locationId },
        },
        data: { isPrimary: false },
      })
    }
    return (tx as any).workspaceLocation.update({
      where: { id: locationId },
      data: {
        ...normalized,
        locationType: prismaLocationTypeByValue[normalized.locationType],
        archivedAt: normalized.isActive ? null : new Date(),
        isPrimary: normalized.isActive ? normalized.isPrimary : false,
      },
    })
  })
  return serializeLocation(location)
}

export async function archiveWorkspaceLocation({
  actor,
  locationId,
}: {
  actor: WorkspaceStructureActor
  locationId: string
}) {
  requireManager(actor)
  const result = await (prisma as any).workspaceLocation.updateMany({
    where: { id: locationId, workspaceId: actor.workspaceId },
    data: { isActive: false, isPrimary: false, archivedAt: new Date() },
  })
  if (!result.count)
    throw new WorkspaceLocationError('Location not found.', 404)
}

export async function restoreWorkspaceLocation({
  actor,
  locationId,
}: {
  actor: WorkspaceStructureActor
  locationId: string
}) {
  requireManager(actor)
  const existing = await (prisma as any).workspaceLocation.findFirst({
    where: { id: locationId, workspaceId: actor.workspaceId },
    select: { id: true, name: true },
  })
  if (!existing) throw new WorkspaceLocationError('Location not found.', 404)
  await assertUniqueActiveLocationName({
    workspaceId: actor.workspaceId,
    name: existing.name,
    exceptLocationId: locationId,
  })
  await (prisma as any).workspaceLocation.update({
    where: { id: locationId },
    data: { isActive: true, archivedAt: null },
  })
}
