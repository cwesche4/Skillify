-- DropIndex
DROP INDEX "CalendarEventMapping_workspaceId_lastSyncOrigin_idx";

-- DropIndex
DROP INDEX "CalendarEventMapping_workspaceId_syncHash_idx";

-- AlterTable
ALTER TABLE "DomainOutboxEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SchedulingNotificationPreference" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SchedulingReminderSchedule" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "OperationalHealthSnapshot_workspaceId_overallStatus_capturedAt_" RENAME TO "OperationalHealthSnapshot_workspaceId_overallStatus_capture_idx";

-- RenameIndex
ALTER INDEX "OperationalKnowledgeUsage_workspaceId_knowledgeItemId_usedAt_id" RENAME TO "OperationalKnowledgeUsage_workspaceId_knowledgeItemId_usedA_idx";

-- RenameIndex
ALTER INDEX "OperationalMetricHistory_workspaceId_domain_metric_measuredAt_i" RENAME TO "OperationalMetricHistory_workspaceId_domain_metric_measured_idx";

-- RenameIndex
ALTER INDEX "OperationalRecommendationHistory_workspaceId_recommendationId_i" RENAME TO "OperationalRecommendationHistory_workspaceId_recommendation_idx";

-- RenameIndex
ALTER INDEX "OperationalRecommendationHistory_workspaceId_sourceDomain_gener" RENAME TO "OperationalRecommendationHistory_workspaceId_sourceDomain_g_idx";

-- RenameIndex
ALTER INDEX "OperationalRecommendationHistory_workspaceId_status_generatedAt" RENAME TO "OperationalRecommendationHistory_workspaceId_status_generat_idx";

-- RenameIndex
ALTER INDEX "OperationalRecommendationOutcome_workspaceId_outcome_occurredAt" RENAME TO "OperationalRecommendationOutcome_workspaceId_outcome_occurr_idx";

-- RenameIndex
ALTER INDEX "OperationalRecommendationOutcome_workspaceId_recommendationId_i" RENAME TO "OperationalRecommendationOutcome_workspaceId_recommendation_idx";

-- RenameIndex
ALTER INDEX "SchedulingNotification_workspaceId_recipientWorkspaceMemberId_r" RENAME TO "SchedulingNotification_workspaceId_recipientWorkspaceMember_idx";

-- RenameIndex
ALTER INDEX "SchedulingNotificationDelivery_workspaceId_recipientUserId_read" RENAME TO "SchedulingNotificationDelivery_workspaceId_recipientUserId__idx";

-- RenameIndex
ALTER INDEX "SchedulingNotificationDelivery_workspaceId_status_nextAttemptAt" RENAME TO "SchedulingNotificationDelivery_workspaceId_status_nextAttem_idx";

-- RenameIndex
ALTER INDEX "SchedulingNotificationPreference_workspaceId_scopeType_workspac" RENAME TO "SchedulingNotificationPreference_workspaceId_scopeType_work_key";

-- RenameIndex
ALTER INDEX "SchedulingRecurrenceMutation_workspaceId_mutationKind_createdAt" RENAME TO "SchedulingRecurrenceMutation_workspaceId_mutationKind_creat_idx";

-- RenameIndex
ALTER INDEX "SchedulingReminderSchedule_recipientUserId_status_scheduledForU" RENAME TO "SchedulingReminderSchedule_recipientUserId_status_scheduled_idx";

-- RenameIndex
ALTER INDEX "SchedulingReminderSchedule_workspaceId_status_scheduledForUtc_i" RENAME TO "SchedulingReminderSchedule_workspaceId_status_scheduledForU_idx";

-- RenameIndex
ALTER INDEX "WorkspaceIntegrationConnection_workspaceId_providerId_externalA" RENAME TO "WorkspaceIntegrationConnection_workspaceId_providerId_exter_key";

-- RenameIndex
ALTER INDEX "WorkspaceKnowledgeApproval_workspaceId_knowledgeItemId_createdA" RENAME TO "WorkspaceKnowledgeApproval_workspaceId_knowledgeItemId_crea_idx";

-- RenameIndex
ALTER INDEX "WorkspaceKnowledgeItem_workspaceId_approvalStatus_isArchived_id" RENAME TO "WorkspaceKnowledgeItem_workspaceId_approvalStatus_isArchive_idx";

-- RenameIndex
ALTER INDEX "WorkspaceKnowledgeRevision_workspaceId_knowledgeItemId_version_" RENAME TO "WorkspaceKnowledgeRevision_workspaceId_knowledgeItemId_vers_idx";

-- RenameIndex
ALTER INDEX "WorkspaceKnowledgeRevision_workspaceId_revisionType_createdAt_i" RENAME TO "WorkspaceKnowledgeRevision_workspaceId_revisionType_created_idx";

-- RenameIndex
ALTER INDEX "WorkspaceRecommendationOutcome_workspaceId_outcome_occurredAt_i" RENAME TO "WorkspaceRecommendationOutcome_workspaceId_outcome_occurred_idx";

-- RenameIndex
ALTER INDEX "WorkspaceRecommendationOutcome_workspaceId_sourceDomain_occurre" RENAME TO "WorkspaceRecommendationOutcome_workspaceId_sourceDomain_occ_idx";
