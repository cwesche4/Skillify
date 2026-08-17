# CRM Knowledge Provider Foundation

Phase 17 adds a deterministic CRM Knowledge Provider for Workspace Intelligence.
It does not add a customer-facing CRM AI surface and it does not mutate CRM
records.

## Current CRM Architecture Audit

The current CRM modules are implemented through page-level client components and
preview storage:

- Leads: `components/dashboard/sales/LeadsClient.tsx`,
  `lib/sales/demoSalesRecords.ts`, `lib/sales/previewLeadStorage.ts`
- Opportunities: `components/dashboard/sales/OpportunitiesClient.tsx`,
  `lib/sales/demoSalesRecords.ts`, `lib/sales/previewOpportunityStorage.ts`
- Clients: `components/dashboard/clients/ClientsClient.tsx`,
  `lib/clients/types.ts`, `lib/clients/previewClientStorage.ts`
- Tasks/work items: `components/dashboard/tasks/TasksClient.tsx`,
  `lib/tasks/demoTasks.ts`, `lib/tasks/previewTaskStorage.ts`
- CRM activity: `lib/workspace-records/activity.ts`

The Prisma schema does not currently contain authoritative `Lead`,
`Opportunity`, `Client`, or CRM task tables. The CRM pages merge demo records
with workspace-scoped preview/session records. Because of that, the production
CRM Knowledge source assembler does not import fixtures or read browser preview
storage. It accepts repository functions at the backend boundary and returns
empty arrays when no authoritative repository is supplied.

## Provider Boundary

The provider lives under `lib/crm/knowledge/` and accepts a normalized
`CRMKnowledgeSource`:

- workspace and actor context
- leads
- follow-up records
- opportunities
- clients
- CRM tasks
- activity
- sales meetings

Every record is filtered by workspace ID before facts are calculated. Actor
permissions are applied before record counts, record IDs, references, or
recommendations are exposed. `crm:read` grants full CRM read access; entity read
permissions such as `leads:read` expose only that entity slice.

## Deterministic Outputs

The provider calculates:

- Lead facts: active, converted, disqualified, overdue/today/due-soon
  follow-ups, stale records, owner/contact/next-step gaps, value, source, owner,
  stage, and status counts.
- Follow-up facts: completed, overdue, today, upcoming, no-response, and owner
  workload.
- Opportunity facts: open/won/lost counts, pipeline value, weighted expected
  revenue, stale opportunities, missing owners, missing next steps, overdue
  close dates, stage values, and owner values.
- Pipeline facts: stage concentration, bottlenecks, top deals, and at-risk
  value.
- Client facts: active/inactive clients, new clients, owner/contact gaps, linked
  lineage, open task counts, and a data limitation warning for non-authoritative
  revenue.
- Data-quality findings: missing owner, missing contact, missing next step,
  invalid/orphaned relationships, inconsistent lifecycle state, permission
  boundaries, and workspace-scope exclusions.
- Deterministic summaries and references safe for AI context.

Recommendations are proposals only. Each recommendation includes:

- a 0-100 deterministic score
- reason codes and supporting facts
- record references
- warnings
- `approvalRequired: true`
- `executionStatus: "notStarted"`

The provider never creates tasks, updates follow-up dates, converts leads,
changes owners, or moves opportunities.

## Workspace Intelligence Integration

The provider is registered in `lib/intelligence/workspaceIntelligence.ts` as
provider ID `crm`. It supports CRM intents including lead prioritization,
follow-up analysis, opportunity/pipeline analysis, data-quality analysis,
record explanation, and CRM next-action recommendations.

Workspace Intelligence continues to assemble:

`KnowledgeProvider -> WorkspaceContext -> WorkspaceState -> WorkspaceSnapshot -> WorkspaceKnowledgeReference`

CRM recommendations are mapped into the existing `WorkspaceRecommendation`
contract so the AI runtime can explain deterministic CRM facts without asking an
AI model to calculate them.

## Deferred Work

The following are intentionally deferred:

- customer-facing CRM AI panels
- AI-authored CRM mutations
- Prisma CRM persistence
- automatic task creation
- automatic lead conversion
- external CRM integrations
- revenue/lifetime-value calculations from non-authoritative CRM data
- predictive sales forecasting
- subjective owner coaching

When authoritative CRM persistence is added, repository implementations should
be supplied to `buildCRMKnowledgeSource()` without changing the provider
calculation contract.
