/*
  Warnings:

  - You are about to drop the column `completedTasks` on the `OnboardingProgress` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `OnboardingProgress` table. All the data in the column will be lost.
  - Added the required column `steps` to the `OnboardingProgress` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OnboardingProgress" DROP COLUMN "completedTasks",
DROP COLUMN "createdAt",
ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "steps" JSONB NOT NULL;
