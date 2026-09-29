-- Phase 9A preserves execution-critical Customer context on each Job. The
-- snapshots are nullable for compatibility with legacy/free-text Jobs.

ALTER TABLE "Job"
ADD COLUMN "serviceLocationSnapshot" TEXT,
ADD COLUMN "customerContactNameSnapshot" TEXT,
ADD COLUMN "customerPhoneSnapshot" TEXT,
ADD COLUMN "customerEmailSnapshot" TEXT;

-- Existing linked Jobs receive a best-effort snapshot. Scheduling remains the
-- location authority for recurring occurrences; manual Jobs use the current
-- Customer service address at migration time.
UPDATE "Job" AS job
SET
  "serviceLocationSnapshot" = COALESCE(
    (
      SELECT event."locationAddress"
      FROM "SchedulingEvent" AS event
      WHERE event."id" = job."schedulingEventId"
        AND event."workspaceId" = job."workspaceId"
    ),
    (
      SELECT event."locationLabel"
      FROM "SchedulingEvent" AS event
      WHERE event."id" = job."schedulingEventId"
        AND event."workspaceId" = job."workspaceId"
    ),
    NULLIF(
      CONCAT_WS(
        E'\n',
        customer."serviceAddressLine1",
        customer."serviceAddressLine2",
        NULLIF(
          CONCAT_WS(
            ', ',
            customer."serviceAddressCity",
            NULLIF(
              CONCAT_WS(
                ' ',
                customer."serviceAddressRegion",
                customer."serviceAddressPostalCode"
              ),
              ''
            )
          ),
          ''
        ),
        customer."serviceAddressCountry"
      ),
      ''
    )
  ),
  "customerContactNameSnapshot" = customer."contactName",
  "customerPhoneSnapshot" = customer."phone",
  "customerEmailSnapshot" = customer."email"
FROM "Customer" AS customer
WHERE customer."id" = job."customerId"
  AND customer."workspaceId" = job."workspaceId";
