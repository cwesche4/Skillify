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
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
} as const

export type WorkspaceMemberRole =
  (typeof WorkspaceMemberRole)[keyof typeof WorkspaceMemberRole]

export const WorkspaceBusinessModel = {
  SIMPLE_SERVICE_BUSINESS: 'SIMPLE_SERVICE_BUSINESS',
  CONSULTATIVE_SALES: 'CONSULTATIVE_SALES',
  DIRECT_SALES: 'DIRECT_SALES',
  PRODUCT_COMMERCE: 'PRODUCT_COMMERCE',
} as const

export type WorkspaceBusinessModel =
  (typeof WorkspaceBusinessModel)[keyof typeof WorkspaceBusinessModel]

export const LeadConversionDestination = {
  OPPORTUNITY: 'OPPORTUNITY',
  SALE: 'SALE',
  CUSTOMER: 'CUSTOMER',
} as const

export type LeadConversionDestination =
  (typeof LeadConversionDestination)[keyof typeof LeadConversionDestination]

export const QualifiedLeadBehavior = {
  ASK: 'ASK',
  AUTO_CONVERT: 'AUTO_CONVERT',
  KEEP_QUALIFIED: 'KEEP_QUALIFIED',
} as const

export type QualifiedLeadBehavior =
  (typeof QualifiedLeadBehavior)[keyof typeof QualifiedLeadBehavior]

export const OperationsPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const

export type OperationsPriority =
  (typeof OperationsPriority)[keyof typeof OperationsPriority]

export const RecurringServiceStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
} as const

export type RecurringServiceStatus =
  (typeof RecurringServiceStatus)[keyof typeof RecurringServiceStatus]

export const JobStatus = {
  OPEN: 'OPEN',
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_ON_CLIENT: 'WAITING_ON_CLIENT',
  UNABLE_TO_COMPLETE: 'UNABLE_TO_COMPLETE',
  COMPLETED: 'COMPLETED',
  CANCELED: 'CANCELED',
} as const

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus]

export const JobCancellationReason = {
  CUSTOMER_REQUEST: 'CUSTOMER_REQUEST',
  WEATHER: 'WEATHER',
  ACCESS_ISSUE: 'ACCESS_ISSUE',
  STAFFING: 'STAFFING',
  EQUIPMENT: 'EQUIPMENT',
  HOLIDAY: 'HOLIDAY',
  SERVICE_ENDED: 'SERVICE_ENDED',
  SCHEDULE_CANCELED: 'SCHEDULE_CANCELED',
  OTHER: 'OTHER',
} as const

export type JobCancellationReason =
  (typeof JobCancellationReason)[keyof typeof JobCancellationReason]

export const JobUnableToCompleteReason = {
  WEATHER: 'WEATHER',
  CUSTOMER_UNAVAILABLE: 'CUSTOMER_UNAVAILABLE',
  ACCESS_ISSUE: 'ACCESS_ISSUE',
  EQUIPMENT: 'EQUIPMENT',
  RAN_OUT_OF_TIME: 'RAN_OUT_OF_TIME',
  OTHER: 'OTHER',
} as const

export type JobUnableToCompleteReason =
  (typeof JobUnableToCompleteReason)[keyof typeof JobUnableToCompleteReason]

export const WorkItemKind = {
  JOB_STEP: 'JOB_STEP',
  TODO: 'TODO',
} as const

export type WorkItemKind = (typeof WorkItemKind)[keyof typeof WorkItemKind]

export const WorkItemStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELED: 'CANCELED',
} as const

export type WorkItemStatus =
  (typeof WorkItemStatus)[keyof typeof WorkItemStatus]

export const LeadStage = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  ESTIMATE_VISIT: 'ESTIMATE_VISIT',
  FOLLOW_UP: 'FOLLOW_UP',
  WON: 'WON',
  LOST: 'LOST',
} as const

export type LeadStage = (typeof LeadStage)[keyof typeof LeadStage]

export const EstimateStatus = {
  DRAFT: 'DRAFT',
  PRESENTED: 'PRESENTED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  SUPERSEDED: 'SUPERSEDED',
  VOIDED: 'VOIDED',
} as const

export type EstimateStatus =
  (typeof EstimateStatus)[keyof typeof EstimateStatus]

export const EstimateBillingBasis = {
  ONE_TIME: 'ONE_TIME',
  PER_VISIT: 'PER_VISIT',
} as const

export type EstimateBillingBasis =
  (typeof EstimateBillingBasis)[keyof typeof EstimateBillingBasis]

export const WorkspaceTeamType = {
  GENERAL: 'GENERAL',
  OFFICE: 'OFFICE',
  FIELD_CREW: 'FIELD_CREW',
  SALES: 'SALES',
  SERVICE: 'SERVICE',
  INSTALLATION: 'INSTALLATION',
  WAREHOUSE: 'WAREHOUSE',
  MANAGEMENT: 'MANAGEMENT',
  OTHER: 'OTHER',
} as const

export type WorkspaceTeamType =
  (typeof WorkspaceTeamType)[keyof typeof WorkspaceTeamType]

export const WorkspaceLocationType = {
  OFFICE: 'OFFICE',
  STORE: 'STORE',
  WAREHOUSE: 'WAREHOUSE',
  SHOP: 'SHOP',
  SERVICE_BASE: 'SERVICE_BASE',
  BRANCH: 'BRANCH',
  REMOTE: 'REMOTE',
  OTHER: 'OTHER',
} as const

export type WorkspaceLocationType =
  (typeof WorkspaceLocationType)[keyof typeof WorkspaceLocationType]

export const WorkspaceAIStatus = {
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  READY: 'READY',
  PAUSED: 'PAUSED',
  DISABLED: 'DISABLED',
} as const

export type WorkspaceAIStatus =
  (typeof WorkspaceAIStatus)[keyof typeof WorkspaceAIStatus]

export const WorkspaceAIActivityType = {
  PROFILE_CREATED: 'PROFILE_CREATED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  CONTEXT_RESOLVED: 'CONTEXT_RESOLVED',
  REQUEST_STARTED: 'REQUEST_STARTED',
  REQUEST_COMPLETED: 'REQUEST_COMPLETED',
  REQUEST_FAILED: 'REQUEST_FAILED',
  ACTION_PROPOSED: 'ACTION_PROPOSED',
  ACTION_APPROVED: 'ACTION_APPROVED',
  ACTION_REJECTED: 'ACTION_REJECTED',
} as const

export type WorkspaceAIActivityType =
  (typeof WorkspaceAIActivityType)[keyof typeof WorkspaceAIActivityType]

export const SubscriptionPlan = {
  Free: 'Free',
  Basic: 'Basic',
  Pro: 'Pro',
  Elite: 'Elite',
} as const

export type SubscriptionPlan =
  (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan]

export const SubscriptionStatus = {
  active: 'active',
  canceled: 'canceled',
  past_due: 'past_due',
  trialing: 'trialing',
} as const

export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus]

export const AccessCodeType = {
  DISCOUNT: 'DISCOUNT',
  TRIAL_EXTENSION: 'TRIAL_EXTENSION',
  COMPLIMENTARY_ACCESS: 'COMPLIMENTARY_ACCESS',
  SPECIAL_PRICE: 'SPECIAL_PRICE',
  INTERNAL_ACCESS: 'INTERNAL_ACCESS',
} as const

export type AccessCodeType =
  (typeof AccessCodeType)[keyof typeof AccessCodeType]

export const SubscriptionAccessSource = {
  NORMAL_TRIAL: 'NORMAL_TRIAL',
  ACCESS_CODE: 'ACCESS_CODE',
  ADMIN_OVERRIDE: 'ADMIN_OVERRIDE',
  STRIPE: 'STRIPE',
} as const

export type SubscriptionAccessSource =
  (typeof SubscriptionAccessSource)[keyof typeof SubscriptionAccessSource]

export const BuildRequestStatus = {
  NEW: 'NEW',
  REVIEWING: 'REVIEWING',
  CLOSED: 'CLOSED',
} as const

export type BuildRequestStatus =
  (typeof BuildRequestStatus)[keyof typeof BuildRequestStatus]

export const IntegrationStatus = {
  connected: 'connected',
  disconnected: 'disconnected',
  error: 'error',
} as const

export type IntegrationStatus =
  (typeof IntegrationStatus)[keyof typeof IntegrationStatus]

export const UserProfileRole = {
  user: 'user',
  admin: 'admin',
  security: 'security',
  legal: 'legal',
  grc: 'grc',
} as const

export type UserProfileRole =
  (typeof UserProfileRole)[keyof typeof UserProfileRole]
