-- CreateTable
CREATE TABLE "BuildRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "website" TEXT,
    "size" TEXT,
    "projectType" TEXT,
    "projectSummary" TEXT NOT NULL,
    "automationCount" INTEGER,
    "budgetRange" TEXT,
    "timeline" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildRequest_pkey" PRIMARY KEY ("id")
);
