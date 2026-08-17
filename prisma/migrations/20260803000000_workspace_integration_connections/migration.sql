-- Additive foundation for workspace-owned integration connections.
-- Existing CRM Integration and Scheduling CalendarConnection records are preserved.

CREATE TYPE "WorkspaceIntegrationCredentialOwnership" AS ENUM (
  'platform',
  'workspaceOAuth',
  'workspaceApiKey',
  'workspaceWebhook',
  'workspaceManual',
  'none'
);

CREATE TYPE "WorkspaceIntegrationConnectionStatus" AS ENUM (
  'notConnected',
  'configurationRequired',
  'connecting',
  'connected',
  'degraded',
  'actionRequired',
  'expired',
  'revoked',
  'error',
  'unavailable',
  'comingSoon'
);

CREATE TABLE "WorkspaceIntegrationConnection" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "ownershipType" "WorkspaceIntegrationCredentialOwnership" NOT NULL,
  "status" "WorkspaceIntegrationConnectionStatus" NOT NULL DEFAULT 'notConnected',
  "externalAccountId" TEXT,
  "externalAccountLabel" TEXT,
  "encryptedCredentials" TEXT,
  "credentialHint" TEXT,
  "grantedScopes" JSONB,
  "tokenExpiresAt" TIMESTAMP(3),
  "refreshStatus" TEXT,
  "providerMetadata" JSONB,
  "connectedByUserId" TEXT,
  "connectedByWorkspaceMemberId" TEXT,
  "connectedAt" TIMESTAMP(3),
  "lastValidatedAt" TIMESTAMP(3),
  "lastSuccessfulSyncAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceIntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceIntegrationConnection_workspaceId_providerId_externalAccountId_key"
  ON "WorkspaceIntegrationConnection"("workspaceId", "providerId", "externalAccountId");

CREATE INDEX "WorkspaceIntegrationConnection_workspaceId_providerId_idx"
  ON "WorkspaceIntegrationConnection"("workspaceId", "providerId");

CREATE INDEX "WorkspaceIntegrationConnection_workspaceId_status_idx"
  ON "WorkspaceIntegrationConnection"("workspaceId", "status");

CREATE INDEX "WorkspaceIntegrationConnection_providerId_idx"
  ON "WorkspaceIntegrationConnection"("providerId");

ALTER TABLE "WorkspaceIntegrationConnection"
  ADD CONSTRAINT "WorkspaceIntegrationConnection_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
