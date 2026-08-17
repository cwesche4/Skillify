# Workspace-Wide AI Investigation Foundation

Workspace-wide AI investigation is the governed path for broad questions that do
not map cleanly to one module-specific intent. It lets Skillify answer questions
such as "What should I focus on today?" by assembling deterministic workspace
state, selecting read-only knowledge tools, and asking a provider to explain the
available evidence.

## Routing

The Internal AI Playground supports two routing modes:

- `AUTO_DETECT`: customer-representative routing. The prompt is classified into a
  supported module intent, a clarification request, or `workspace.investigateQuestion`.
- `FORCE_INTENT`: internal testing override. This bypasses natural routing and is
  not representative of customer-facing behavior.

Broad or cross-domain prompts route to `workspace.investigateQuestion`. Narrow
assignment prompts route to the scheduling assignment intent only when the
required appointment context is present; otherwise the response asks for
clarification instead of fabricating a recommendation.

The playground context selectors pass stable object references through the
request contract. Scheduling event references include enough display metadata
for internal operators to distinguish real appointments without opening the
calendar first: title, customer or location, date and time, assignment, status,
and team when available. Selecting a clarification option updates the context
only; it does not automatically rerun the request.

Follow-up routing is grounded in the previous routed answer, not the currently
selected playground tab. Ambiguous prompts such as "which one should I fix
first?" inherit the prior turn's resolved domain and intent unless the prompt
explicitly switches topics. Auto-detect mode must not pass the selected tab as a
hard domain hint; selected tabs are internal context aids, while resolved
runtime intents are authoritative.

## Data Availability

Domain availability is explicit:

- Available: Scheduling and CRM knowledge providers.
- Partial: tasks, projects, service requests, members, teams, locations,
  workflow builder, automations, integrations, notifications, and workspace
  setup/readiness context where repository sources exist.
- Deferred: marketing/ad attribution and authoritative finance or margin data.

Deferred domains may appear in an investigation plan as missing data, but they
must not be presented as confirmed evidence.

Partial domains must be described honestly. For example, Skillify may know that
tasks, service requests, or automations exist as workspace concepts while still
lacking authoritative SLA, dependency, failure-category, or attribution facts.
Responses should name those gaps instead of implying a complete workspace audit.

## Knowledge Tools

The knowledge-tool catalog is read-only. Tools describe deterministic context
that can be assembled or inspected. They do not execute business actions, mutate
records, call external systems, or bypass existing permission filtering.

Investigation plans are built from registered tools only. Unknown provider tool
requests are omitted and reported as non-blocking validation warnings.

## Claims

Workspace investigation responses distinguish:

- `CONFIRMED`: supported by deterministic references or assembled context.
- `INFERRED`: reasoned from available deterministic evidence.
- `DERIVED_METRIC`: calculated from available deterministic inputs, with the
  underlying data scope still visible.
- `DATA_QUALITY_LIMITATION`: a limitation in the inspected data set or an
  unavailable domain needed to answer the question completely.
- `UNKNOWN`: cannot be answered from current authoritative data.

The UI exposes analysis plans and claim provenance in the Internal AI Playground
developer inspection panel. Customer-facing experiences should show readable
answers and uncertainty without exposing internal provider payloads.

Readable playground output uses the same distinctions. Missing data is phrased
as "Data needed to answer this" so operators can tell whether an answer is a
true finding, a partial finding, or a blocked investigation.

Provider fallback is explicit. Runtime responses expose `providerOutcome` so the
UI can distinguish generated answers from deterministic fallback, provider
timeouts, provider unavailability, validation fallback, and failed provider
attempts. If a provider was attempted and timed out or failed, fallback copy must
say that Skillify is showing deterministic workspace knowledge; it must not say
that no provider was invoked.

Workspace investigation plans now include governed knowledge-growth metadata:
known facts, unknowns, structured knowledge gaps, confidence factors, and a
workspace-scoped growth snapshot. See `docs/ai/workspace-knowledge-growth.md`
for the approval, source, learning-queue, outcome, and aggregate-learning
contracts.

## Execution Boundary

This phase is propose-only. AI may explain, summarize, investigate, and propose
safe next steps. It may not execute workflow runs, send messages, change records,
or mutate Scheduling, CRM, Commerce, Operations, or workspace settings.

Action proposals are normalized before runtime validation. Malformed provider
entries are omitted instead of being displayed as broken actions, while valid
proposals still must pass the allow-list for the requested output type.

## Provider Boundaries

Mock provider output is internal-only. Customer-facing AI uses the configured
production provider path. Provider outputs are normalized so the runtime intent
and output type remain authoritative, and malformed runtime events or tool
requests cannot crash the playground.

Readable playground warnings are grouped by purpose: runtime errors, provider
warnings, data needed, coverage limitations, validation warnings, and fallback
warnings. This keeps deterministic knowledge gaps separate from provider
failures and avoids presenting fallback summaries as full AI-generated answers.

## Internal Playground Reliability

Each Internal AI Playground run carries a fresh client request ID. Reusing the
same prompt is treated as a new test run unless the user explicitly sends a
follow-up, while an HTTP retry may reuse the same request ID for correlation.
The Run Test action creates a new request ID; Retry test reuses the failed
request ID so persistence and diagnostics can distinguish a retry from a new
observation.

The route records stage checkpoints for:
request received, request validated, authorized, entry point resolved, intent
resolved, context assembled, knowledge loaded, provider request built, provider
invoked, provider normalized, response validated, Operational Intelligence
built, optional persistence, developer inspection, response serialization, and
response returned. Browser-safe diagnostics report the failed stage, last
completed stage, next expected stage, safe code, retryability, response status,
provider outcome, and persistence status. `UNKNOWN_PLAYGROUND_FAILURE` is
reserved for failures before a useful checkpoint exists or failures inside the
diagnostic boundary itself.

The valid Workspace AI response is the primary result. Developer inspection,
Operational Intelligence history aggregation, persistence, and audit details are
non-critical playground stages. If one of those stages fails after a response has
been generated, the route returns the valid response with a safe internal
diagnostic instead of discarding the answer.

Operational Intelligence in the Internal AI Playground defaults to Preview only.
Playground runs do not write production Operational Intelligence history unless
a future internal-only persistence setting explicitly opts into a test snapshot.
When persistence is introduced, stable issue identity should represent the
underlying operational issue, while run/request identity represents a specific
observation. Repeated observations should update lifecycle state or append
history according to that model, not collide on deterministic IDs.

Operational Intelligence persistence separates stable issue identity from
observation identity. The stable issue/finding key is workspace-scoped and based
on the underlying operational issue. Observation rows use the runtime request ID
so the same request ID is idempotent, while the same prompt with a new request ID
can record a new observation and update first-seen, last-seen, occurrence count,
and lifecycle state. Test snapshots, when enabled later, must be labeled as
internal playground/test data and excluded from production dashboard signals,
production trends, recurring-risk counts, health snapshots, and platform
aggregate learning by default.

Playground diagnostics are sanitized for the browser and include request ID,
failure stage, safe code, retryability, provider outcome, and persistence status.
Raw database errors, SQL, provider secrets, stack traces, and runtime-only
objects remain server-only.

## Scheduling Conflict Semantics

Scheduling AI conflict counts refer to active blocking conflicts only.
Informational availability constraints are preserved but counted separately.

- Blocking conflict examples: assigned event overlaps where a blocking event
  actually consumes availability.
- Informational constraint examples: nearby time off, external availability
  windows, or availability exceptions that do not identify a conflicting source
  event in the selected range.

The normalized conflict taxonomy stores `category` and `blocking` on each
finding. Readable output should say "active blocking conflicts" for blocking
counts and separately mention informational availability constraints when they
exist.

## Scheduling Mutations

Scheduling create/update API errors include a safe request reference and
development-stage metadata such as validation, repository, or database failure
stage. Customer-facing error messages remain sanitized; raw database or provider
messages are not exposed.

Recurring-event duplication is scope-aware. Duplicating this occurrence creates a
standalone copy. Duplicating an entire series copies the recurrence rule into a
new series but intentionally does not copy occurrence-specific overrides,
deleted occurrence state, external provider mappings, sync state, or history.

## Development Demo Data

The development demo generator supports named deterministic presets and optional
JSON configuration. Presets seed realistic scheduling distribution patterns for
AI Playground and Scheduling AI scenarios without adding production fixtures or
pretending unsupported modules are populated.

Examples:

```bash
npm run demo:workspace -- --workspace-slug skillify-hq --preset ai-playground-comprehensive --seed 42
npm run demo:workspace -- --workspace-slug skillify-hq --config ./demo-config.json
npm run demo:workspace -- --workspace-slug skillify-hq --preset dispatch-chaos --dry-run
```

Supported preset names:

- `scheduling-balanced`
- `scheduling-overloaded`
- `dispatch-chaos`
- `clean-small-business`
- `service-business-growth`
- `automation-failure-review`
- `ai-playground-comprehensive`

Configuration may override preset values such as scheduling event count,
recurring percentage, unassigned percentage, seed, date distribution, workload
distribution, teams, locations, members, scheduling contacts, recurrence counts,
emergency counts, availability counts, and requested unsupported modules.
Unsupported modules are reported in the dry-run and summary output; they are not
fabricated into records.

Development-tool summaries distinguish Scheduling Contacts from CRM Clients.
Scheduling contacts are generated for appointment and assignment scenarios. CRM
Clients remain `0` unless an authoritative CRM client source is populated by a
future demo-data phase.

The generator remains development-only and guarded from production use.
