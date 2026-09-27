import { Prisma } from '@prisma/client'

import type { CustomerStore } from '@/lib/customers/service'
import { prisma } from '@/lib/db'

export const prismaCustomerStore: CustomerStore = {
  async getWorkspaceBusinessModel(workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { businessModel: true },
    })
    return workspace?.businessModel ?? null
  },

  async isWorkspaceMember({ workspaceId, memberId }) {
    const member = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      select: { id: true },
    })
    return Boolean(member)
  },

  createCustomer(data) {
    return prisma.customer.create({ data })
  },

  findCustomer({ workspaceId, customerId }) {
    return prisma.customer.findFirst({
      where: { id: customerId, workspaceId, archivedAt: null },
    })
  },

  listCustomers({ workspaceId, search }) {
    return prisma.customer.findMany({
      where: {
        workspaceId,
        archivedAt: null,
        ...(search
          ? {
              OR: [
                { displayName: { contains: search, mode: 'insensitive' } },
                { companyName: { contains: search, mode: 'insensitive' } },
                { contactName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    })
  },

  updateCustomer({ workspaceId, customerId, data }) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.customer.updateMany({
        where: { id: customerId, workspaceId, archivedAt: null },
        data,
      })
      if (result.count !== 1) return null
      return tx.customer.findFirst({
        where: { id: customerId, workspaceId, archivedAt: null },
      })
    })
  },

  archiveCustomer({ workspaceId, customerId, archivedAt }) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "Customer" WHERE "id" = ${customerId} AND "workspaceId" = ${workspaceId} AND "archivedAt" IS NULL FOR UPDATE`,
      )
      if (locked.length !== 1) return null
      const activeRecurringService = await tx.recurringService.findFirst({
        where: {
          workspaceId,
          customerId,
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
        select: { id: true },
      })
      if (activeRecurringService) {
        return { blockedByActiveRecurringService: true } as const
      }
      const result = await tx.customer.updateMany({
        where: { id: customerId, workspaceId, archivedAt: null },
        data: { archivedAt },
      })
      if (result.count !== 1) return null
      return tx.customer.findFirst({
        where: { id: customerId, workspaceId },
      })
    })
  },
}
