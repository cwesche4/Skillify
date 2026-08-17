import type {
  CRMActivityKnowledgeRecord,
  CRMClientKnowledgeRecord,
  CRMFollowUpKnowledgeRecord,
  CRMKnowledgeActor,
  CRMKnowledgeContextRequest,
  CRMKnowledgeSource,
  CRMKnowledgeWorkspace,
  CRMLeadKnowledgeRecord,
  CRMMeetingKnowledgeRecord,
  CRMOpportunityKnowledgeRecord,
  CRMTaskKnowledgeRecord,
} from '@/lib/crm/knowledge/crmKnowledgeTypes'

export type CRMKnowledgeRepositories = {
  listLeads?: (workspaceId: string) => Promise<CRMLeadKnowledgeRecord[]>
  listFollowUps?: (workspaceId: string) => Promise<CRMFollowUpKnowledgeRecord[]>
  listOpportunities?: (
    workspaceId: string,
  ) => Promise<CRMOpportunityKnowledgeRecord[]>
  listClients?: (workspaceId: string) => Promise<CRMClientKnowledgeRecord[]>
  listTasks?: (workspaceId: string) => Promise<CRMTaskKnowledgeRecord[]>
  listActivities?: (
    workspaceId: string,
  ) => Promise<CRMActivityKnowledgeRecord[]>
  listMeetings?: (workspaceId: string) => Promise<CRMMeetingKnowledgeRecord[]>
}

export type BuildCRMKnowledgeSourceRequest = {
  workspace: CRMKnowledgeWorkspace
  actor: CRMKnowledgeActor
  now: Date | string
  context?: CRMKnowledgeContextRequest
  repositories?: CRMKnowledgeRepositories
}

export async function buildCRMKnowledgeSource({
  workspace,
  actor,
  now,
  context,
  repositories,
}: BuildCRMKnowledgeSourceRequest): Promise<CRMKnowledgeSource> {
  const workspaceId = workspace.id
  return {
    workspace,
    actor,
    now,
    context,
    leads: (await repositories?.listLeads?.(workspaceId)) ?? [],
    followUps: (await repositories?.listFollowUps?.(workspaceId)) ?? [],
    opportunities: (await repositories?.listOpportunities?.(workspaceId)) ?? [],
    clients: (await repositories?.listClients?.(workspaceId)) ?? [],
    tasks: (await repositories?.listTasks?.(workspaceId)) ?? [],
    activities: (await repositories?.listActivities?.(workspaceId)) ?? [],
    meetings: (await repositories?.listMeetings?.(workspaceId)) ?? [],
  }
}

export function createCRMKnowledgeSourceFromRecords(
  source: CRMKnowledgeSource,
): CRMKnowledgeSource {
  return {
    ...source,
    leads: source.leads ?? [],
    followUps: source.followUps ?? [],
    opportunities: source.opportunities ?? [],
    clients: source.clients ?? [],
    tasks: source.tasks ?? [],
    activities: source.activities ?? [],
    meetings: source.meetings ?? [],
  }
}
