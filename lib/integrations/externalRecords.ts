import { prisma } from '@/lib/db'

export async function upsertExternalRecord({
  workspaceId,
  provider,
  objectType,
  externalId,
  integrationId,
  localType,
  localId,
}: {
  workspaceId: string
  provider: string
  objectType: string
  externalId: string
  integrationId?: string | null
  localType?: string | null
  localId?: string | null
}) {
  if (!externalId) return
  await prisma.externalRecord.upsert({
    where: {
      workspaceId_provider_objectType_externalId: {
        workspaceId,
        provider,
        objectType,
        externalId,
      },
    },
    create: {
      workspaceId,
      provider,
      objectType,
      externalId,
      integrationId: integrationId ?? undefined,
      localType: localType ?? undefined,
      localId: localId ?? undefined,
    },
    update: {
      integrationId: integrationId ?? undefined,
      localType: localType ?? undefined,
      localId: localId ?? undefined,
    },
  })
}
