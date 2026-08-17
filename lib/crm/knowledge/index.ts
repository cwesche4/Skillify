export {
  getCRMKnowledgeContext,
  getCRMKnowledgeExplanation,
  getCRMKnowledgeRecommendations,
  getCRMKnowledgeSnapshot,
} from '@/lib/crm/knowledge/crmKnowledgeProvider'
export {
  CRM_KNOWLEDGE_THRESHOLDS,
  clampScore,
  dateKeyInTimezone,
  resolveCRMKnowledgeThresholds,
} from '@/lib/crm/knowledge/crmKnowledgeScoring'
export {
  buildCRMKnowledgeSource,
  createCRMKnowledgeSourceFromRecords,
  type CRMKnowledgeRepositories,
} from '@/lib/crm/knowledge/crmKnowledgeSource'
export type {
  CRMActivityFacts,
  CRMActivityKnowledgeRecord,
  CRMClientFacts,
  CRMClientKnowledgeRecord,
  CRMDataQualityFinding,
  CRMEntityType,
  CRMFollowUpFacts,
  CRMFollowUpKnowledgeRecord,
  CRMKnowledgeActor,
  CRMKnowledgeContextRequest,
  CRMKnowledgeSnapshot,
  CRMKnowledgeSource,
  CRMKnowledgeWorkspace,
  CRMLeadFacts,
  CRMLeadKnowledgeRecord,
  CRMMeetingKnowledgeRecord,
  CRMOpportunityFacts,
  CRMOpportunityKnowledgeRecord,
  CRMPipelineFacts,
  CRMRecommendation,
  CRMReference,
  CRMRisk,
  CRMTaskKnowledgeRecord,
} from '@/lib/crm/knowledge/crmKnowledgeTypes'
