```mdx-all-in-one
# 🤝 Contributing to Skillify

Thank you for helping improve Skillify — an enterprise-grade AI automation platform.

This guide explains how to contribute safely and consistently.

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
