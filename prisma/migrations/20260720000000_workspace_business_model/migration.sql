-- Workspace business-model configuration for dynamic CRM routing.
CREATE TYPE "WorkspaceBusinessModel" AS ENUM (
  'CONSULTATIVE_SALES',
  'DIRECT_SALES',
  'PRODUCT_COMMERCE'
);

CREATE TYPE "LeadConversionDestination" AS ENUM (
  'OPPORTUNITY',
  'SALE',
  'CUSTOMER'
);

ALTER TABLE "Workspace"
  ADD COLUMN "businessModel" "WorkspaceBusinessModel" NOT NULL DEFAULT 'DIRECT_SALES',
  ADD COLUMN "opportunitiesEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "commerceEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "defaultLeadDestination" "LeadConversionDestination" NOT NULL DEFAULT 'SALE',
  ADD COLUMN "allowDirectLeadToSale" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "customerSingularLabel" TEXT NOT NULL DEFAULT 'Client',
  ADD COLUMN "customerPluralLabel" TEXT NOT NULL DEFAULT 'Clients',
  ADD COLUMN "salesLabel" TEXT NOT NULL DEFAULT 'Sales';

-- Preserve current visible CRM behavior for existing workspaces by keeping
-- opportunities visible and defaulting lead conversion to Opportunity.
UPDATE "Workspace"
SET
  "businessModel" = 'CONSULTATIVE_SALES',
  "opportunitiesEnabled" = true,
  "defaultLeadDestination" = 'OPPORTUNITY',
  "allowDirectLeadToSale" = true,
  "commerceEnabled" = false,
  "customerSingularLabel" = 'Client',
  "customerPluralLabel" = 'Clients',
  "salesLabel" = 'Sales';
