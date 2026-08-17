# Product & Commerce Order Status Transitions

Skillify treats commerce status changes as deterministic native lifecycle events.
Core expected commerce behavior belongs in native lifecycle rules: order state,
payment state, and fulfillment state remain separate dimensions with their own
registries and transition validation.

User automations should respond to lifecycle events for company-specific behavior,
such as sending a custom follow-up, notifying a team, or creating a task. They
should not become the source of truth for whether an order is paid, cancelled,
fulfilled, or returned.

The workspace AI assistant may explain statuses, recommend next steps, and help
configure workflows around commerce events. It is not the authority for status
transitions.

The current quick-status update boundary validates status domains, writes one
preview/local order update, records one activity entry, and exposes
`applyCommerceLifecycleEffects(...)` as the future integration point. The full
native commerce lifecycle engine is intentionally deferred.
