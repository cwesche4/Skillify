import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    workspaceLocation: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  }

  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      workspaceMember: {
        findMany: vi.fn(),
      },
      workspaceTeam: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      workspaceLocation: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  }
})

vi.mock('@/lib/db', () => ({
  prisma: mocks.prisma,
}))

import { createWorkspaceLocation } from '@/lib/workspaceStructure/locations'
import { classifyWorkspaceStructureError } from '@/lib/workspaceStructure/apiErrors'
import {
  createWorkspaceTeam,
  listWorkspaceTeams,
} from '@/lib/workspaceStructure/teams'
import { listWorkspaceLocations } from '@/lib/workspaceStructure/locations'

const actor = {
  workspaceId: 'workspace-alpha',
  actorUserId: 'user-owner',
  canManageWorkspace: true,
}

const createdAt = new Date('2026-07-25T12:00:00.000Z')

describe('workspace structure services', () => {
  beforeEach(() => {
    mocks.prisma.$transaction.mockReset()
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback(mocks.tx),
    )
    mocks.prisma.workspaceMember.findMany.mockReset()
    mocks.prisma.workspaceTeam.findFirst.mockReset()
    mocks.prisma.workspaceTeam.findMany.mockReset()
    mocks.prisma.workspaceTeam.create.mockReset()
    mocks.prisma.workspaceLocation.findFirst.mockReset()
    mocks.prisma.workspaceLocation.findMany.mockReset()
    mocks.tx.workspaceLocation.updateMany.mockReset()
    mocks.tx.workspaceLocation.create.mockReset()
  })

  it('classifies missing workspace structure tables as schema not ready', () => {
    expect(classifyWorkspaceStructureError({ code: 'P2021' })).toMatchObject({
      status: 503,
      payload: {
        ok: false,
        code: 'WORKSPACE_STRUCTURE_SCHEMA_NOT_READY',
        message:
          'Workspace Teams and Locations are not available because the latest database migration has not been applied.',
      },
    })
    expect(classifyWorkspaceStructureError({ code: 'P2022' })).toMatchObject({
      status: 503,
      payload: {
        code: 'WORKSPACE_STRUCTURE_SCHEMA_NOT_READY',
      },
    })
  })

  it('classifies database connectivity failures separately from validation', () => {
    expect(classifyWorkspaceStructureError({ code: 'P1001' })).toMatchObject({
      status: 503,
      payload: {
        ok: false,
        code: 'DATABASE_UNAVAILABLE',
        message:
          'Skillify could not connect to the database. Check the local database service and try again.',
      },
    })
  })

  it('returns empty success lists when authoritative tables exist without records', async () => {
    mocks.prisma.workspaceTeam.findMany.mockResolvedValue([])
    mocks.prisma.workspaceLocation.findMany.mockResolvedValue([])

    await expect(
      listWorkspaceTeams({ workspaceId: actor.workspaceId }),
    ).resolves.toEqual([])
    await expect(
      listWorkspaceLocations({ workspaceId: actor.workspaceId }),
    ).resolves.toEqual([])
  })

  it('creates workspace teams with validated workspace members and a stable team type', async () => {
    mocks.prisma.workspaceMember.findMany.mockResolvedValue([
      { id: 'member-owner' },
      { id: 'member-tech' },
    ])
    mocks.prisma.workspaceTeam.findFirst.mockResolvedValue(null)
    mocks.prisma.workspaceTeam.create.mockResolvedValue({
      id: 'team-field',
      workspaceId: actor.workspaceId,
      name: 'Field Crew',
      description: 'Service technicians',
      teamType: 'FIELD_CREW',
      leadMemberId: 'member-owner',
      isActive: true,
      archivedAt: null,
      createdAt,
      updatedAt: createdAt,
      members: [
        {
          id: 'team-member-owner',
          workspaceMemberId: 'member-owner',
          roleLabel: null,
          isPrimary: true,
          workspaceMember: {
            user: { fullName: 'Owner', email: 'owner@example.com' },
          },
        },
        {
          id: 'team-member-tech',
          workspaceMemberId: 'member-tech',
          roleLabel: null,
          isPrimary: false,
          workspaceMember: {
            user: { fullName: 'Technician', email: 'tech@example.com' },
          },
        },
      ],
    })

    const team = await createWorkspaceTeam({
      actor,
      input: {
        name: ' Field   Crew ',
        description: ' Service technicians ',
        teamType: 'fieldCrew',
        leadMemberId: 'member-owner',
        memberIds: ['member-tech'],
      },
    })

    expect(mocks.prisma.workspaceMember.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: actor.workspaceId,
        id: { in: ['member-tech', 'member-owner'] },
      },
      select: { id: true },
    })
    expect(mocks.prisma.workspaceTeam.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: actor.workspaceId,
          name: 'Field Crew',
          teamType: 'FIELD_CREW',
          leadMemberId: 'member-owner',
          members: {
            create: expect.arrayContaining([
              expect.objectContaining({
                workspaceMemberId: 'member-owner',
                isPrimary: true,
              }),
              expect.objectContaining({
                workspaceMemberId: 'member-tech',
                isPrimary: false,
              }),
            ]),
          },
        }),
      }),
    )
    expect(team).toMatchObject({
      id: 'team-field',
      name: 'Field Crew',
      teamType: 'fieldCrew',
      isActive: true,
    })
  })

  it('rejects duplicate active team names inside one workspace', async () => {
    mocks.prisma.workspaceMember.findMany.mockResolvedValue([])
    mocks.prisma.workspaceTeam.findFirst.mockResolvedValue({ id: 'team-old' })

    await expect(
      createWorkspaceTeam({
        actor,
        input: { name: 'Field Crew', teamType: 'fieldCrew' },
      }),
    ).rejects.toMatchObject({
      message: 'A team with this name already exists.',
      fieldErrors: { name: 'A team with this name already exists.' },
    })
    expect(mocks.prisma.workspaceTeam.create).not.toHaveBeenCalled()
  })

  it('rejects team members from a different workspace', async () => {
    mocks.prisma.workspaceMember.findMany.mockResolvedValue([
      { id: 'member-owner' },
    ])

    await expect(
      createWorkspaceTeam({
        actor,
        input: {
          name: 'Office Team',
          teamType: 'office',
          memberIds: ['member-owner', 'member-foreign'],
        },
      }),
    ).rejects.toMatchObject({
      message: 'Choose workspace members for this team.',
      fieldErrors: {
        memberIds:
          'One or more selected members do not belong to this workspace.',
      },
    })
    expect(mocks.prisma.workspaceTeam.create).not.toHaveBeenCalled()
  })

  it('creates business locations and enforces one primary location per workspace', async () => {
    mocks.prisma.workspaceLocation.findFirst.mockResolvedValue(null)
    mocks.tx.workspaceLocation.create.mockResolvedValue({
      id: 'location-main',
      workspaceId: actor.workspaceId,
      name: 'Main Office',
      locationType: 'OFFICE',
      addressLine1: '100 Main St',
      addressLine2: null,
      city: 'Fairfax',
      region: 'VA',
      postalCode: '22030',
      countryCode: 'US',
      timezone: 'America/New_York',
      phone: null,
      notes: null,
      isPrimary: true,
      isActive: true,
      archivedAt: null,
      createdAt,
      updatedAt: createdAt,
    })

    const location = await createWorkspaceLocation({
      actor,
      input: {
        name: ' Main   Office ',
        locationType: 'office',
        addressLine1: '100 Main St',
        city: 'Fairfax',
        region: 'VA',
        postalCode: '22030',
        countryCode: 'us',
        timezone: 'America/New_York',
        isPrimary: true,
      },
    })

    expect(mocks.tx.workspaceLocation.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: actor.workspaceId, archivedAt: null },
      data: { isPrimary: false },
    })
    expect(mocks.tx.workspaceLocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: actor.workspaceId,
        name: 'Main Office',
        locationType: 'OFFICE',
        countryCode: 'US',
        isPrimary: true,
        timezone: 'America/New_York',
      }),
    })
    expect(location).toMatchObject({
      id: 'location-main',
      name: 'Main Office',
      locationType: 'office',
      isPrimary: true,
    })
  })

  it('rejects invalid business location timezones', async () => {
    await expect(
      createWorkspaceLocation({
        actor,
        input: {
          name: 'Main Office',
          locationType: 'office',
          timezone: 'Eastern',
        },
      }),
    ).rejects.toMatchObject({
      message: 'Choose a valid timezone.',
      fieldErrors: { timezone: 'Choose a valid IANA timezone.' },
    })
    expect(mocks.tx.workspaceLocation.create).not.toHaveBeenCalled()
  })
})
