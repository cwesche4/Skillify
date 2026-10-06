# Controlled pilot provisioning

This operator-only workflow grants one finite Skillify subscription for a
controlled pilot. It is not checkout, payment collection, public access-code
redemption, or a general subscription administration tool.

## Prerequisites

- Use the frozen, reviewed release checkout.
- Load the intended database environment explicitly; never paste a database URL
  into the command.
- Confirm the target already has a `UserProfile` with an exact Clerk user ID.
- Assign a Pilot Provisioning Operator and record a bounded operational reason.
- Use an expiration no more than 90 days in the future. This is a conservative
  controlled-pilot operator safety limit, not a pricing or general billing
  policy.
- If the user owns one active Workspace, obtain its exact ID. The workflow
  refuses multi-Workspace owners because the authoritative subscription is
  user-level and cannot be limited safely to one owned Workspace.

The entitlement is deliberately user-level, matching Skillify's existing
Subscription ownership model. The optional Workspace ID is durable audit
context, not a Workspace-scoped entitlement. Any Workspace the user later owns
can inherit the same finite Subscription until it expires. If approval requires
strict one-Workspace containment, do not provision that pilot under the current
architecture.

The workflow never calls Clerk or another external provider. It supports exact
Clerk user IDs only; email and fuzzy lookup are intentionally unsupported.

## Dry run

Dry-run is the default. It validates the target, plan, finite expiration,
Workspace boundary, current subscription state, environment category, and
idempotency without writing.

```bash
npm run pilot:provision -- \
  --clerk-user-id user_PLACEHOLDER \
  --plan Pro \
  --expires-at 2027-01-01T00:00:00.000Z \
  --operator release-operator-placeholder \
  --reason "Controlled pilot approval placeholder" \
  --workspace-id workspace_PLACEHOLDER \
  --environment staging
```

Omit `--workspace-id` only when the user owns no Workspace yet. A successful
dry run prints a request-specific, non-secret confirmation token bound to the
target, plan, expiration, Workspace context, environment, operator, and reason,
and ends with:

```text
DRY RUN — NO CHANGES MADE
```

The displayed expiry must still be within 90 days when the command is run; the
dates above are examples, not recommended production values.

## Execute

Repeat the validated command with both `--execute` and the exact token printed
by its dry run:

```bash
npm run pilot:provision -- \
  --clerk-user-id user_PLACEHOLDER \
  --plan Pro \
  --expires-at 2027-01-01T00:00:00.000Z \
  --operator release-operator-placeholder \
  --reason "Controlled pilot approval placeholder" \
  --workspace-id workspace_PLACEHOLDER \
  --environment staging \
  --execute \
  --confirm PROVISION-PILOT-DRY_RUN_TOKEN
```

Production additionally requires:

```text
--environment production --confirm-production I-UNDERSTAND-PRODUCTION
```

That phrase is an execution guard, not a secret and not proof that the loaded
database is production. Operators remain responsible for loading and verifying
the intended environment under the separate production-change authorization.
The script refuses local/remote category mismatches and never prints the URL.

## Durable result and audit evidence

Successful execution is one database transaction. It creates:

- an inactive, consumed, single-user `INTERNAL_ACCESS` authority;
- a finite `trialing` Subscription with no payment method requirement;
- one `AccessCodeRedemption` linked to the user, Subscription, and optional
  Workspace;
- bounded structured operator and reason evidence in `internalReason`.

The internal code is not printed and cannot be redeemed by a customer. A
simultaneous request is serialized by locking the target `UserProfile`.
Uniqueness and exact-state checks prevent a double grant.

An identical repeat reports:

```text
ALREADY PROVISIONED — NO CHANGE
```

A different plan, expiration, Workspace, paid Subscription, permanent/manual
entitlement, or inconsistent partial state fails closed. The workflow never
upgrades, downgrades, extends, or replaces an existing different entitlement.

## Verification and expiration

Verify through bounded database/operator tooling that:

- the Subscription plan matches the approved plan;
- status is `trialing`;
- `trialEndsAt`, `complimentaryEndsAt`, and `currentPeriodEnd` match the
  approved expiration;
- access source is `ACCESS_CODE`;
- the related authority is inactive with one allowed/recorded use;
- exactly one matching redemption exists.

Access expires through the existing finite entitlement checks. This workflow
stores the boundary in both `complimentaryEndsAt` and `currentPeriodEnd`.
Server-side user and Workspace plan resolution checks the trial or
complimentary boundary on every request: at the expiration instant and after,
the pilot no longer contributes a paid plan and resolves to the next valid
authority or `Free` (`Basic` for the legacy user-tier helper). No scheduler is
required. This workflow does not provide early revocation or extension. If
either is required, stop and use a separately reviewed
subscription-administration procedure; do not edit rows manually and do not
rerun with a different request.

## Do not

- Do not run the retired `force-elite-subscription.ts` script.
- Do not omit the dry run or reuse a token from another request.
- Do not provision a paid subscriber or a multi-Workspace owner.
- Do not use a 2099/permanent expiration.
- Do not expose database URLs, internal codes, customer PII, or credentials in
  tickets or logs.
- Do not treat this workflow as self-service billing or customer checkout.
- Do not run it against production without separate production authorization.
