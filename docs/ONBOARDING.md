```mdx-all-in-one
# 🚀 Skillify Developer Onboarding Guide

Welcome to the Skillify engineering team!

Follow this guide to set up your environment and begin contributing.

------------------------------------------------------------
# 1. Requirements

Install:
- Node 20+
- pnpm or npm 10+
- Postgres 14+
- VSCode
- Docker (optional)
- Git

------------------------------------------------------------
# 2. Clone the repository

git clone https://github.com/YOUR-ORG/nextjs_skillify.git  
cd nextjs_skillify  

------------------------------------------------------------
# 3. Install dependencies

npm install

------------------------------------------------------------
# 4. Create your .env file

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/skillify?schema=public"  
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""  
CLERK_SECRET_KEY=""  
OPENAI_API_KEY=""  

------------------------------------------------------------
# 5. Set up database

npm run prisma:generate  
npm run prisma:migrate  
npm run prisma:seed  
npm run studio  

------------------------------------------------------------
# 6. Start the app

npm run dev

App runs at:
http://localhost:3000

------------------------------------------------------------
# 7. Required VSCode Extensions

ESLint  
Prettier  
Tailwind CSS IntelliSense  
Jest Runner  
Spell Checker  

------------------------------------------------------------
# 8. Daily Development Flow

1. Pull latest  
2. Create feature branch  
3. Code  
4. Test  
5. Lint  
6. PR  

Commands:
npm run lint  
npm run test  
npm run type-check  

------------------------------------------------------------

© Skills Enterprises, LLC — All Rights Reserved.
```