```mdx-all-in-one
# 🔌 Skillify API Guide

A reference for building and extending API endpoints in Skillify.

------------------------------------------------------------
# 1. API Principles

All APIs must:
- Be workspace-aware
- Validate input using Zod
- Enforce Clerk auth
- Enforce workspace membership
- Return typed responses
- Never expose internal errors

------------------------------------------------------------
# 2. Convention

Routes live under:
app/api/{workspaceId}/...

Pattern:
- GET → fetch
- POST → create
- PATCH → update
- DELETE → remove

Responses use:
{
  success: boolean,
  data?: any,
  error?: string
}

------------------------------------------------------------
# 3. Workspace Enforcement

Every route must include:

1. Clerk user extraction
2. WorkspaceId parameter
3. Membership validation
4. Role validation (Owner/Admin) if needed

------------------------------------------------------------
# 4. Streaming Endpoints

Used for:
- AI Coach Live
- Live analytics
- Real-time automation run logs

Rules:
- Use ReadableStream
- Implement heartbeats
- Clean up setInterval on abort

------------------------------------------------------------
# 5. Automation-Related APIs

Automation CRUD:
- Create automation
- Save flow (JSON)
- Run automation
- Fetch runs
- Compare runs

Validation:
- NodeData must match schema
- Flow graph validated server-side

------------------------------------------------------------
# 6. Analytics APIs

Must:
- Aggregate DB data
- Compute trends
- Load balanced via caching

APIs:
- /analytics/trends
- /analytics/success-rate
- /analytics/heatmap
- /analytics/insights

------------------------------------------------------------
# 7. Error Handling

Return meaningful errors:

400 — invalid input
401 — unauthorized
403 — forbidden
404 — not found
500 — internal error

NEVER leak stack traces to client.

------------------------------------------------------------

© Skills Enterprises, LLC — All Rights Reserved.
```
