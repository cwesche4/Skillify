# ⚡ Skillify — AI-Powered Automation Platform

Skillify is an enterprise-grade automation platform built on Next.js, Prisma 7, Postgres, ReactFlow, Clerk Authentication, TailwindCSS, and a fully custom AI automation builder.

This repository contains the full Skillify application: API routes, automation builder, AI Coach, analytics engine, command center, workspace system, and subscription gating.

---

## 🚀 Tech Stack

| Layer     | Technologies                                                         |
| --------- | -------------------------------------------------------------------- |
| Frontend  | Next.js 14 (App Router), React 18, TailwindCSS 3, Framer Motion      |
| Backend   | Next.js API Routes, Prisma 7 + PrismaPg Adapter, Postgres            |
| AI System | OpenAI API, AI Coach, AI Insights Engine                             |
| Builder   | ReactFlow 11, Custom Node Types, Autosave, History, Groups, AI Nodes |
| Auth      | Clerk                                                                |
| Analytics | Heatmaps, Trends, Success Rates, Recharts                            |
| Testing   | Vitest + React Testing Library + JSDOM                               |
| Tooling   | Turbo, ESLint Flat Config, Prettier, Tailwind Plugins                |

---

# 📦 Installation

Clone the repository:

git clone https://github.com/cwesche4/nextjs_skillify.git
cd nextjs_skillify

Install dependencies:

npm install

---

## ⚙️ Environment Variables

Create a `.env`/`.env.local` and include:

- Core: `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `OPENAI_API_KEY`
- CRM (HubSpot) when integrations are enabled (see `docs/INTEGRATIONS_ENV.md`):
  - `INTEGRATIONS_ENCRYPTION_KEY` — **base64-encoded 32 bytes** (`openssl rand -base64 32`)
  - `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_URI`
  - Quick test + webhook simulator steps: see `docs/CRM_QUICK_TEST.md`

---

## 🗄 Database Setup (Prisma 7)

Generate Prisma client:
npm run prisma:generate

Format schema:
npm run prisma:format

Run migrations:
npm run prisma:migrate

Seed the database:
npm run prisma:seed

Open Prisma Studio:
npm run studio

---

## 🛠 Scripts (package.json)

dev: turbo run dev
build: turbo run build
start: next start
lint: npm run lint
format: prettier --write .
type-check: tsc -p tsconfig.app.json
test: vitest run
test:ui: vitest --ui

---

## 🧪 Testing (Vitest + RTL)

Run all tests:
npm run test

Open testing UI:
npm run test:ui

Includes:

- Smoke tests
- React rendering tests
- Dashboard tests
- Utility tests
- Full JSDOM environment

---

## 🧹 Enterprise Linting + Formatting

Skillify includes:

- ESLint Flat Config
- Type-aware TypeScript analysis
- React + Hooks rules
- Tailwind class validation
- Prettier auto-formatting
- Turbo integration
- VSCode automation

---

## HUD Intelligence (Planned, Inactive)

- The builder HUD includes design-only scaffolding for future intelligence (context-aware hints, AI badge surfaces, suggestion ranking), but **no learning, tracking, telemetry, or AI inference** runs today.
- All intelligence remains human-in-the-loop, opt-in, and reversible; there are no background mutations or automatic actions.
- Profiles, learning, AI bridge, and ranking contracts live under `lib/hud/intelligence/` as documentation-only types.
- A preview-only HUD intelligence UI is gated and mock-only; dismissals are local and non-persistent.

## 🔧 VSCode Extensions (recommended)

Create `.vscode/extensions.json` with:

dbaeumer.vscode-eslint  
esbenp.prettier-vscode  
bradlc.vscode-tailwindcss  
streetsidesoftware.code-spell-checker  
csstools.postcss  
firsttris.vscode-jest-runner

---

## ⚡ Auto-Fix On Save

Create `.vscode/settings.json`:

editor.formatOnSave = true  
source.fixAll = always  
source.fixAll.eslint = always  
eslint.validate = javascript, javascriptreact, typescript, typescriptreact  
files.eol = \n

---

## 📐 Prettier Configuration

prettier.config.cjs:

semi: false  
singleQuote: true  
trailingComma: all  
tabWidth: 2  
printWidth: 100  
bracketSpacing: true  
plugins: prettier-plugin-tailwindcss

---

## 🚫 Prettier Ignore

node_modules  
.next  
dist  
coverage  
prisma/migrations  
public

---

## 🧭 Project Structure

app/ — Next.js app router  
components/ — UI, Dashboard, Builder components  
lib/ — Logic, analytics, helpers  
prisma/ — Schema + migrations  
tests/ — Vitest  
scripts/ — Tooling scripts  
public/ — Static assets

---

## 🤖 AI Systems

### AI Coach

- Live insights
- Trend analytics
- Cost optimization
- Anomaly detection

### AI Builder Assist

- AI Explain
- AI Optimize
- Auto layout guidance

### AI Search

- Workspace-aware semantic search

---

## 🧱 Automation Builder (ReactFlow Enterprise Edition)

Includes:

- Custom node types
- Drag & drop palette
- AI nodes (LLM, Classifier, Splitter)
- Group nodes
- Autosave
- Undo/redo
- Snap grid
- History stack
- Auto layout
- Fullscreen mode
- Unified NodeData

### Automation Builder Overview

- `BuilderInner.tsx` orchestrates the ReactFlow canvas, HUD, panels, overlays, shortcuts, and workspace-scoped persistence.
- High-level features: HUD controls and presets, collapsible panels, drag/drop canvas with ghost nodes, context menu for actions, keyboard shortcuts/command palette, inline rename, multi-select, auto layout, and fullscreen canvas mode.

### Protected Architecture Zones

- `BuilderInner.tsx` is additive-only; avoid refactors and preserve section headers.
- Layout, canvas math, HUD placement, and panel grid are tightly coupled and should not be modified without explicit approval.

### Extension Philosophy

- Extend via overlays, optional panels, hooks, or gated features.
- Avoid core logic rewrites; changes must layer on top of existing behavior.

### Run Timeline & Replay System

- Manual, scrubbable timeline for past executions (no auto-play).
- Replay overlay highlights active nodes by timestamp; read-only visualization.
- No hidden automation or mutations; human-in-the-loop only.

### Run Timeline (Backend-Driven, Read-Only)

- Timeline data is fetched per automation/run and treated as immutable.
- Scrubbing remains manual; no auto-playback or execution side effects.
- Runs and events are read-only snapshots used only for inspection.

### AI Coach Overlay Philosophy

- Inline, non-blocking callouts near nodes/edges (bottlenecks, failures, optimizations).
- Read-only guidance; no automatic changes or side effects.
- Feature-gated and additive to the existing canvas experience.

### Collaboration Layer (Visual + Soft Locks Only)

- Presence cursors and node locks are visual overlays; they do not mutate automation state.
- Soft locks are UI cues; no persistence or server enforcement yet.
- All collaboration features are opt-in and reversible.

### Collaboration & Versioning (Planned)

- No realtime syncing, cursor rendering, or lock enforcement is active yet.
- Versioning is manual and read-only-first; snapshots are auditable and opt-in.
- Future implementation will remain feature-gated and non-disruptive to the builder.

Future realtime checklist (design only):

- [ ] Presence polling/WebSockets gated by feature flag
- [ ] Cursor + lock rendering layers (non-blocking)
- [ ] Version-aware restore with manual confirmation
- [ ] Conflict handling surfaced to the user

### Collaboration Preview

- Preview overlays are visual-only and rely on static/mock data.
- No networking, persistence, or enforcement is active.
- All overlays default to pointer-events-none and are feature-gated.

### Presence Polling (Active)

- Polling-only presence; read-only cursors rendered with pointer-events-none.
- TTL pruning removes stale cursors; future upgrade path to WebSockets is gated.
- Throttled heartbeats; no locking or mutation enforced by presence alone.

### Soft Locks (UI-only, Active)

- Soft-lock visuals show collaborator intent (hover/select/drag) without blocking edits.
- Overlays are pointer-events-none and feature-gated; no persistence or enforcement.
- Future hard-lock or conflict flows must remain opt-in and explicit.

### Conflict Resolution UX (Planned)

- Conflicts surface via banner/modal when edits collide or versions drift.
- Edits pause softly while the user chooses: Keep mine, Use theirs, Fork new version, or Cancel/reload.
- No automatic merges; all choices are human-in-the-loop and reversible.

### Cursor Color Assignment

- Cursor colors are chosen via deterministic hashing of user IDs against a fixed accessible palette.
- Collisions fall forward to the next palette entry when salted.
- Palette avoids low-contrast combinations and stays readable on dark backgrounds.

### Versioning Philosophy

- Versioning is manual, safe, and auditable; no automatic saves or merges.
- Snapshots capture nodes, edges, and viewport metadata for restore/diff flows.
- Feature-gated and read-only-first to protect active automations.
- `app/dashboard/[workspaceSlug]/automations/[automationId]/builder/components/CanvasContextMenu.tsx` — right-click actions and contextual commands
- `app/dashboard/[workspaceSlug]/automations/[automationId]/builder/components/NodePalette` / `.../InspectorPanel` — node sourcing and node detail editing

### Architectural Philosophy

- The builder embraces intentional complexity to deliver rich canvas behaviors.
- Changes should be additive and scoped; broad refactors are discouraged.
- Respect section headers and comment banners; they exist to protect interdependent logic.

---

## 🔐 Workspaces & Permissions

- Multi-tenant
- Workspace creation
- Member invites
- Roles: OWNER, ADMIN, MEMBER
- Subscription tier gating
- Workspace-aware routing

---

## 📊 Analytics Engine

- Reliability heatmaps
- Success trends
- Cost analytics
- AI insights
- Failure breakdown
- Run comparison

---

## ⚡ Command Center

- AI-powered command search
- Keyboard shortcuts
- Deep search
- Workspace-aware actions

---

## 🧾 License

© Skills Enterprises, LLC — All Rights Reserved.
