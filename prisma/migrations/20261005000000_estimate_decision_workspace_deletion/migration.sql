-- Keep Estimate decision evidence immutable while a workspace is live, but
-- permit explicit transactional deletion of the enclosing workspace graph.
--
-- A deferred workspace-survival guard rejects every DELETE while the owning
-- Workspace remains present at commit, even if related commercial state was
-- also rewritten or removed. During explicit workspace deletion, the owning
-- Workspace is removed in the same transaction, so the guard permits the
-- complete graph deletion. The existing deferred projection trigger remains
-- an independent consistency check.

DROP TRIGGER "EstimateDecision_immutable_check" ON "EstimateDecision";

CREATE TRIGGER "EstimateDecision_immutable_check"
BEFORE UPDATE ON "EstimateDecision"
FOR EACH ROW
EXECUTE FUNCTION "prevent_estimate_decision_mutation"();

CREATE FUNCTION "prevent_live_estimate_decision_delete"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Workspace"
    WHERE "id" = OLD."workspaceId"
  ) THEN
    RAISE EXCEPTION 'Estimate decision evidence cannot be deleted while its workspace exists.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "EstimateDecision_live_workspace_delete_check"
AFTER DELETE ON "EstimateDecision"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "prevent_live_estimate_decision_delete"();
