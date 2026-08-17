ALTER TABLE "WorkspaceSettings" ADD COLUMN IF NOT EXISTS "scheduling" JSONB;
ALTER TABLE "WorkspaceSettings" ADD COLUMN IF NOT EXISTS "schedulingEvents" JSONB;
