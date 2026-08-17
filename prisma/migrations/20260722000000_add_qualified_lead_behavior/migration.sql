CREATE TYPE "QualifiedLeadBehavior" AS ENUM (
  'ASK',
  'AUTO_CONVERT',
  'KEEP_QUALIFIED'
);

ALTER TABLE "Workspace"
  ADD COLUMN "qualifiedLeadBehavior" "QualifiedLeadBehavior" NOT NULL DEFAULT 'ASK';

