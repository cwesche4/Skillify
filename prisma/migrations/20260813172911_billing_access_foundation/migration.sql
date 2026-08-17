-- CreateEnum
CREATE TYPE "AccessCodeType" AS ENUM ('DISCOUNT', 'TRIAL_EXTENSION', 'COMPLIMENTARY_ACCESS', 'SPECIAL_PRICE', 'INTERNAL_ACCESS');

-- CreateEnum
CREATE TYPE "SubscriptionAccessSource" AS ENUM ('NORMAL_TRIAL', 'ACCESS_CODE', 'ADMIN_OVERRIDE', 'STRIPE');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "accessCodeId" TEXT,
ADD COLUMN     "accessReason" TEXT,
ADD COLUMN     "accessSource" "SubscriptionAccessSource" NOT NULL DEFAULT 'NORMAL_TRIAL',
ADD COLUMN     "complimentaryEndsAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethodRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AccessCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "type" "AccessCodeType" NOT NULL,
    "plan" "SubscriptionPlan",
    "discountPercent" INTEGER,
    "discountAmountCents" INTEGER,
    "trialDaysOverride" INTEGER,
    "complimentaryDays" INTEGER,
    "complimentaryUntil" TIMESTAMP(3),
    "paymentMethodRequired" BOOLEAN,
    "maxUses" INTEGER,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "internalReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessCodeRedemption" (
    "id" TEXT NOT NULL,
    "accessCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "subscriptionId" TEXT,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessCodeRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessCode_code_key" ON "AccessCode"("code");

-- CreateIndex
CREATE INDEX "AccessCode_active_type_idx" ON "AccessCode"("active", "type");

-- CreateIndex
CREATE INDEX "AccessCode_plan_idx" ON "AccessCode"("plan");

-- CreateIndex
CREATE INDEX "AccessCode_startsAt_expiresAt_idx" ON "AccessCode"("startsAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AccessCodeRedemption_userId_redeemedAt_idx" ON "AccessCodeRedemption"("userId", "redeemedAt");

-- CreateIndex
CREATE INDEX "AccessCodeRedemption_workspaceId_redeemedAt_idx" ON "AccessCodeRedemption"("workspaceId", "redeemedAt");

-- CreateIndex
CREATE INDEX "AccessCodeRedemption_subscriptionId_idx" ON "AccessCodeRedemption"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessCodeRedemption_accessCodeId_userId_key" ON "AccessCodeRedemption"("accessCodeId", "userId");

-- CreateIndex
CREATE INDEX "Subscription_accessCodeId_idx" ON "Subscription"("accessCodeId");

-- CreateIndex
CREATE INDEX "Subscription_status_trialEndsAt_idx" ON "Subscription"("status", "trialEndsAt");

-- CreateIndex
CREATE INDEX "Subscription_status_complimentaryEndsAt_idx" ON "Subscription"("status", "complimentaryEndsAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_accessCodeId_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "AccessCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCodeRedemption" ADD CONSTRAINT "AccessCodeRedemption_accessCodeId_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "AccessCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCodeRedemption" ADD CONSTRAINT "AccessCodeRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCodeRedemption" ADD CONSTRAINT "AccessCodeRedemption_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCodeRedemption" ADD CONSTRAINT "AccessCodeRedemption_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
