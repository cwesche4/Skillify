```mdx-all-in-one
# 🛠️ Skillify Developer Guide
A complete engineering reference for maintaining and extending the Skillify platform.  
This file defines architecture, coding standards, folder rules, and required conventions.

------------------------------------------------------------
TABLE OF CONTENTS
1. Architecture
2. Tech Stack
3. Folder Structure
4. Development Standards
5. API Rules
6. Database & Prisma Standards
7. Automation Builder Architecture
8. AI System Architecture
9. Analytics Engine
10. Testing
11. Deployment
12. Contribution Workflow
------------------------------------------------------------

# 1. Architecture
Skillify is a multi-tenant automation platform featuring:
- Next.js 14 App Router
- Prisma 7 + Postgres
- ReactFlow enterprise automation builder
- AI systems (Coach, Insights, Search)
- Workspace system with roles
- Real-time streaming endpoints
- Command Center global search
- Tier-gated subscription system

Follow clean, feature-based architecture:
- UI separated from logic
- All heavy computations in /lib
- API routes handle validation + auth
- No cross-feature imports

------------------------------------------------------------

# 2. Tech Stack Overview
Frontend: Next.js 14, React 18, TailwindCSS, Framer Motion  
Backend: Next.js API Routes, Prisma 7, Postgres  
AI: OpenAI API + AI Coach + Insights Engine  
Builder: ReactFlow 11 (Unified NodeData — no generics)  
Auth: Clerk  
Testing: Vitest, RTL, JSDOM  
Tooling: Turbo, ESLint Flat Config, Prettier, Husky  

------------------------------------------------------------

# 3. Folder Structure

app/              UI + routing + page-level logic
app/api/          API routes (workspace-aware)
components/       UI, dashboards, builder, command center
lib/              analytics, db, auth, utils, AI
lib/ai/           AI engines
lib/analytics/    analytics engine
lib/auth/         user + workspace logic
lib/utils/        helpers
prisma/           schema + seed
scripts/          build/lint/typecheck scripts
tests/            Vitest suite
public/           static assets
docs/             documentation folder

RULES:
- Never import across features directly → use /lib/*
- Builder files stay in app/dashboard/automations/
- AI logic lives ONLY in lib/ai/
- Access Prisma ONLY through lib/db.ts

------------------------------------------------------------

# 4. Development Standards

# TypeScript
- Strict mode required
- No implicit any
- ALWAYS type server responses
- Unified NodeData for ReactFlow (no generics)
- Zod for validation

# UI Standards
- Prefer Server Components
- Client components only for interactivity
- Tailwind only for styling
- Animations handled via Framer Motion

# Performance Rules
- Batch Prisma queries
- Cache heavy functions
- All analytics processed server-side
- Use streaming APIs for long operations

------------------------------------------------------------

# 5. API Rules

All routes must:
- Validate with Zod
- Enforce Clerk auth
- Respect workspace boundaries
- Return structured errors
- Avoid console.log in production

Streaming API routes must:
- Clean up intervals/timeouts
- Use AbortController correctly

------------------------------------------------------------

# 6. Database & Prisma Standards

General Rules:
- No raw SQL
- All DB logic in lib/db.ts
- Keep migrations readable
- Run format before committing

Important Commands:
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run studio

------------------------------------------------------------

# 7. Automation Builder Architecture

Builder Rules:
- Unified NodeData (NO generics)
- Node types in /builder/node-types/
- Autosave with debounce
- Undo/Redo history
- Group nodes supported
- Inspector panel edits selection
- AI assistant for suggestions
- Snap grid + auto-layout

BuilderInner Responsibilities:
- Canvas rendering
- Keyboard shortcuts
- Node palette
- AI assistant UI
- Autosave logic
- Fullscreen mode
- Context menus

------------------------------------------------------------

# 8. AI System Architecture

AI Coach:
- Anomaly detection
- Trend analysis
- Cost optimization
- Improvement recommendations

AI Node Assistant:
- Explain nodes
- Suggest fixes
- Optimize flow logic

AI Search:
- Workspace-aware embeddings
- Semantic search
- Contextual ranking

------------------------------------------------------------

# 9. Analytics Engine

Features:
- Success rate aggregation
- Trend line generation
- Reliability heatmaps
- Cost-per-run metrics
- Failure clusters
- AI insights extraction

Rules:
- All analytics computed server-side
- NEVER compute analytics in React components
- Cache results where possible

------------------------------------------------------------

# 10. Testing

Skillify uses Vitest + RTL + JSDOM.

Test Types:
- Smoke tests
- UI rendering tests
- Dashboard behavior tests
- Hooks tests
- API route tests
- Utility function tests

Commands:
npm run test
npm run test:ui

------------------------------------------------------------

# 11. Deployment

Use:
- Vercel for frontend
- Railway / Neon / Supabase for Postgres

Checklist:
- ENV vars set
- Migrations run
- Build passes
- Type-check passes
- Lint passes

------------------------------------------------------------

# 12. Contribution Workflow

1. Create a new branch  
2. Make changes  
3. Add/Update tests  
4. Run lint + test + type-check  
5. Submit PR  
6. Review + merge  

------------------------------------------------------------

© Skills Enterprises, LLC — All Rights Reserved.
```