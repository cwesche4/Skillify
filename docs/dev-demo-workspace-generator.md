# Development Demo Workspace Generator

The development demo workspace generator populates an existing Skillify workspace
with deterministic service-business scheduling data for local QA, demos, and AI
scheduling evaluation.

It is development-only. The script refuses to run when `NODE_ENV=production`.

## Run

Use an existing development workspace:

```bash
npm run demo:workspace -- --workspace-slug your-workspace-slug
```

Or target a workspace ID directly:

```bash
npm run demo:workspace -- --workspace-id workspace_123
```

If both `--workspace-id` and `--workspace-slug` are supplied, they must resolve
to the same workspace. The CLI fails safely if they do not.

Optional deterministic date anchor:

```bash
npm run demo:workspace -- --workspace-slug your-workspace-slug --anchor-date 2026-07-30
```

Preview the plan without writing records:

```bash
npm run demo:workspace -- --workspace-slug your-workspace-slug --dry-run
```

## Reset and Regenerate

Rerun the command. The generator deletes prior records with the
`skillify-mechanical-demo` workspace-specific prefix, then recreates the same
deterministic data. It does not touch non-demo records.

## Workspace Identity

Skillify keeps workspace identity split into three concepts:

- `Workspace.id` is the immutable internal primary key. Database relations,
  memberships, permissions, and server authorization use this value.
- `Workspace.slug` is the human-readable URL identifier used in
  `/dashboard/[workspaceSlug]` routes.
- `Workspace.name` is the editable display name shown to users.

Workspace slugs identify the workspace itself. They must not include member IDs
or user IDs. New workspace slugs are generated from the workspace name, for
example:

- `Skillify HQ` -> `skillify-hq`
- `Commonwealth Gas & Well LLC` -> `commonwealth-gas-and-well-llc`
- `Johnson Plumbing` -> `johnson-plumbing`

If a readable slug already exists, Skillify uses numeric suffixes such as
`skillify-hq-2` and retries creation around the database-level unique
constraint.

Existing machine-generated slugs are not renamed automatically. In development,
owners/admins can explicitly update the current workspace slug from the
Development Tools page.

## Development Admin Toolbox

In non-production environments, workspace owners/admins can open:

```text
/dashboard/<workspace-slug>/admin/dev-tools
```

The toolbox supports:

- Generate Demo Data
- Regenerate Demo Data
- Reset Demo Data
- Refresh Summary
- Update Slug from the workspace name
- Copy the equivalent CLI command

Production safety:

- The page is hidden in production.
- The server endpoint returns 404 in production.
- Requests require an authenticated active workspace membership.
- Only workspace Owner/Admin roles may run actions.
- The browser never shells out; the endpoint calls the generator service
  directly.

## Slug Conversion

For a development workspace named `Skillify HQ` with a machine-generated slug
such as:

```text
workspace-cmjounji600008n9k5c0wzca7
```

the Admin toolbox previews:

```text
skillify-hq
```

or the next available readable variant. Confirming the update changes only
`Workspace.slug`; `Workspace.id`, memberships, scheduling records, and related
data are preserved. Old bookmarked URLs may stop working because this pass does
not add slug aliases.

## Advisory Lock Compatibility

Scheduling recurrence mutations use PostgreSQL transaction-scoped advisory
locks through `pg_advisory_xact_lock`. PostgreSQL returns `void` from that
function, and Prisma cannot deserialize a `void` result column. The repository
therefore invokes the same lock function but casts the result to text:

```sql
SELECT pg_advisory_xact_lock($1, $2)::text AS lock_result
```

This keeps the same blocking transaction-scoped lock behavior while returning a
Prisma-supported scalar.

## Troubleshooting Stale Scheduling Data

After generate/reset/regenerate, the development endpoint revalidates the
dashboard, Scheduling, Calendar, Appointments, Team Availability, Members, and
Settings routes for the current workspace. If the browser still shows stale
records, refresh the current Scheduling route or navigate away and back.

## Generated Data

The demo represents `Skillify Mechanical Services`, an HVAC, plumbing, and
electrical service business.

It creates:

- 3 teams: Residential Service, Commercial Projects, Emergency Response.
- 3 locations: North Branch, Central Dispatch, South Service Yard.
- 10 technicians with realistic names, roles, skills, certifications, teams,
  locations, and working-hours notes.
- 54 customer-like records represented through linked scheduling record labels
  and external attendees because commerce/CRM customer persistence is still
  module-specific in the current architecture.
- 112 scheduling appointments across the previous, current, and next week.
- Working hours, PTO, training, sick day, external busy blocks, and availability
  exceptions.
- Recurring service visit masters using the Scheduling recurrence architecture.

The generated schedule intentionally includes operational problems:

- overloaded technician
- double booking
- PTO conflict
- after-hours emergency
- unassigned work
- certification mismatch
- location mismatch
- long travel
- recurring collision
- customer-requested unavailable technician
- external-calendar busy block

These records are designed to make Scheduling AI, Busy derivation, conflict
warnings, route optimization, dispatch review, and upcoming schedule panels
produce meaningful answers.

## Persistence Boundary

This generator does not add Prisma models or migrations. It persists records
using existing workspace, member, team, location, scheduling event, recurrence,
assignment, attendee, and availability tables.

CRM, commerce customer, service request, and revenue-specific records are not
persisted by this script because those modules currently use their own preview
or module-specific storage patterns. Customer context is still available to
Scheduling through linked record labels, linked record IDs, addresses, and
external attendees.
