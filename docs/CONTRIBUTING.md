```mdx-all-in-one
# 🤝 Contributing to Skillify

Thank you for helping improve Skillify — an enterprise-grade AI automation platform.

This guide explains how to contribute safely and consistently.

------------------------------------------------------------
# ⚠️ Automation Builder Contribution Rules

- No layout rewrites
- No HUD relocation without opt-in
- No canvas math changes
- Additive-only checklist before PR
- Required manual test checklist

- [ ] No layout regressions
- [ ] No ReactFlow behavior changes
- [ ] No state removal
- [ ] No hook dependency changes

------------------------------------------------------------

### Automation Builder Contribution Rules

- No layout rewrites or HUD relocation without explicit opt-in
- Do not change canvas math or panel grid
- Only additive overlays/panels/hooks; avoid touching core logic
- Manual test checklist: fullscreen, drag/drop, keyboard shortcuts, HUD behavior, and overlays

### Run Timeline & AI Coach Additions

- Timeline/replay systems must remain manual and read-only.
- AI Coach overlays must be non-blocking and feature-gated.
- Avoid hidden automation or side effects; keep guidance human-driven.

### Run Timeline (Backend-Driven, Read-Only)

- Fetch runs/timelines per automation; treat data as immutable.
- No auto-playback or execution side effects; scrubbing only.
- Use feature flag gating for all timeline/replay wiring.

### Collaboration Layer (Visual + Soft Locks Only)

- Presence cursors and soft locks are overlays only; no state mutation.
- No persistence or server enforcement yet; reversible and opt-in.
- Keep pointer-events disabled on overlays to avoid blocking canvas interactions.

### Lock Escalation Plan

- Soft lock on selection/intent; advisory only.
- Escalate to hard lock on drag/edit/inspector focus (future), with short expiry.
- Hard lock prevents edits; overrides require explicit user action + permission.

### Versioning Rules

- Never auto-create or mutate versions without explicit user action.
- Version lists and restores must be gated; default read-only-first.
- Document changes and ensure restore flows are manual and reversible.

### Collaboration & Versioning (Planned)

- Realtime presence, cursor rendering, and lock enforcement are not active yet.
- Keep all collaboration/versioning additions feature-gated and non-blocking.
- Before enabling realtime: verify polling/WebSocket safety, UI overlays remain pointer-events-none, and version restores require explicit confirmation.

### Collaboration Preview Rules

- Preview overlays use static/mock data; do not wire to live mutation paths.
- Keep pointer-events-none for cursors/locks; no blocking interactions.
- Do not enable realtime or persistence without explicit approval and gating.

### Presence Polling Rules

- Presence is polling-only and read-only; no lock enforcement or mutations.
- Throttle broadcasts; respect TTL expiry and keep overlays non-blocking.
- Future WebSocket upgrades must remain feature-gated and opt-in.

### Soft Lock Visualization Rules

- Soft locks are visual intent cues only; never block edits or mutate nodes.
- Keep overlays pointer-events-none; no enforcement or auto-escalation.
- Any future hard-locking or conflicts must be explicit, gated, and reversible.

- Never enforce locks without explicit approval; keep soft-lock overlays advisory only.

### HUD Intelligence (Planned, Inactive)

- HUD intelligence (learning, hints, AI bridge, ranking) is design-only. No live learning, telemetry, or AI inference is active.
- Keep any intelligence additions human-in-the-loop, dismissible, and feature-gated. Do not auto-execute suggestions.
- Document contracts under `lib/hud/intelligence/`; do not wire runtime logic until explicitly approved.
- Any HUD intelligence preview UI must stay mock-only, with local dismissals and zero persistence or backend calls.

### Conflict Resolution Rules

- Conflict resolution must remain manual; no background auto-merging.
- No silent overwrites; surface choices clearly (keep mine, use theirs, fork, cancel/reload).
- Version restore requires confirmation and should be feature-gated.
# ⚠️ Automation Builder Contribution Rules

- Do not refactor BuilderInner.tsx unless explicitly required
- Do not reorganize hooks, effects, or state blocks
- Add features in isolated sections only
- Respect comment banners and section headers
- Prefer extension over modification
- Test fullscreen, drag/drop, keyboard shortcuts, and HUD behavior after any change

Checklist:
- [ ] No layout regressions
- [ ] No ReactFlow behavior changes
- [ ] No state removal
- [ ] No hook dependency changes

------------------------------------------------------------
# 1. Branch Workflow

ALWAYS use feature branches:

feature/automation-improve
feature/ai-coach-live
fix/workspace-settings
chore/deps-update

Never push directly to main.

------------------------------------------------------------
# 2. Commit Standards

Use Conventional Commits:

feat: add AI Coach anomaly engine
fix: resolve Prisma workspace query
docs: update builder instructions
test: add tests for automation runs
chore: update dependencies

Small, focused commits only.

------------------------------------------------------------
# 3. Pull Request Rules

Every PR must include:

- Summary of changes
- Screenshots (UI changes)
- Tests if applicable
- "Before/After" if logic changed
- No commented-out code
- No console.log

PR must pass:

- Type-check
- Lint
- Unit tests
- Build

------------------------------------------------------------
# 4. Coding Rules

## TypeScript
- No implicit any
- No generics in ReactFlow
- Strong types for all API responses
- Use Zod for validation

## React
- Prefer Server Components
- Client components only when needed
- Tailwind for styling
- Use Framer Motion for animations

## Prisma
- All DB access through lib/db.ts
- No raw SQL
- No queries inside components

------------------------------------------------------------
# 5. File & Folder Rules

Keep structure:

app/               UI + routes
app/api/           API logic
components/        shared UI
lib/               logic, utils, AI, analytics
prisma/            schema + seeds
tests/             unit + integration
docs/              documentation

DO NOT import feature code directly across folders — always use lib.

------------------------------------------------------------
# 6. Test Requirements

Every new logic feature requires:

- Smoke test
- Behavior test
- API test if applicable

Commands:

npm run test
npm run test:ui

------------------------------------------------------------
# 7. Review Process

Reviewer checks for:

- Correct folder usage
- Code quality
- Performance issues
- Security issues
- Workspace permission enforcement
- Subscription tier compliance

------------------------------------------------------------
# 8. Merge Rules

Only merge when:

- All checks pass
- PR approved
- No conflicts
- Documentation updated if needed

------------------------------------------------------------

© Skills Enterprises, LLC — All Rights Reserved.
```
