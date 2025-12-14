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
