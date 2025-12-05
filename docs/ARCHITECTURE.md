```mdx-all-in-one
# 🏗️ Skillify Architecture Overview

Skillify is a multi-tenant AI automation platform built for enterprise workflows.

This document describes the entire system architecture.

------------------------------------------------------------
# 1. High-Level System

Components:
- Next.js (UI + API)
- Prisma 7 + Postgres (DB layer)
- ReactFlow 11 (automation builder)
- AI Engines (Coach, Insights, Search)
- Workspace System (multi-tenant)
- Command Center (global search)
- Subscription engine (Basic / Pro / Elite)

Data flows through:
UI → API → Prisma → DB → AI → UI  

------------------------------------------------------------
# 2. Client Architecture

Client contains:
- Page-level server components
- Client components for interactivity
- Builder canvas
- Inspector panels
- Command Center modal
- Workspace switcher
- AI Coach Live sidebar

Rules:
- Keep pages small
- Move logic to lib/
- Use Suspense for heavy operations

------------------------------------------------------------
# 3. API Architecture

API routes live in:
app/api/**

Rules:
- Use Zod for validation
- Enforce Clerk user
- Enforce workspace authorization
- No database logic in routes
- Use lib for business logic
- Structured JSON responses

Streaming (AI Coach Live) uses:
- ReadableStream
- Heartbeat intervals
- Cleanup on abort

------------------------------------------------------------
# 4. Database Architecture

Tables include:
- UserProfile  
- Workspace  
- WorkspaceMember  
- Automation  
- AutomationRun  
- Subscription  
- AutomationFlow (JSON)  

Rules:
- Prisma used everywhere
- No raw SQL
- prisma.$transaction for critical updates

------------------------------------------------------------
# 5. Automation Builder Architecture

Builder uses ReactFlow 11 with:
- Unified NodeData
- Custom nodes
- Groups
- Autosave
- Undo/Redo
- AI suggestions
- Fullscreen mode
- Snapping grid
- Palette + inspector

State management:
- useNodesState()
- useEdgesState()
- Context for selection
- Debounced autosave

All builder logic stored in:
app/dashboard/automations/...  
lib/builder/...  

------------------------------------------------------------
# 6. AI Architecture

AI Coach:
- Detects anomalies
- Computes trends
- Highlights improvements
- Provides recommendations

AI Node Assistant:
- Explains nodes
- Suggests changes
- Improves flows

AI Search:
- Embeddings per workspace
- Custom ranking

------------------------------------------------------------
# 7. Analytics Architecture

Features:
- Success rate engine
- Failure clusters
- Cost-per-run aggregation
- Reliability heatmap matrix
- Run comparison
- AI insights engine

Rules:
- Never compute analytics in components
- Heavy computation runs server-side
- Use caching

------------------------------------------------------------

# 8. Deployment Architecture

Frontend: Vercel  
Database: Railway / Neon / Supabase  
Secrets: Environment variables  
Storage: Prisma migrations  
Monitoring: Vercel logs + DB dashboards  

------------------------------------------------------------

© Skills Enterprises, LLC — All Rights Reserved.
```