// lib/prisma/enums.ts

export const AutomationStatus = {
  INACTIVE: 'INACTIVE',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
} as const

export type AutomationStatus =
  (typeof AutomationStatus)[keyof typeof AutomationStatus]

export const RunStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const

export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus]

export const WorkspaceMemberRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const

export type WorkspaceMemberRole =
  (typeof WorkspaceMemberRole)[keyof typeof WorkspaceMemberRole]
