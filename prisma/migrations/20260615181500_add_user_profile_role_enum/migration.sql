-- CreateEnum
CREATE TYPE "UserProfileRole" AS ENUM ('user', 'admin', 'security', 'legal', 'grc');

-- Normalize existing text values before casting to the enum.
UPDATE "UserProfile"
SET "role" = CASE
    WHEN lower(trim("role")) = 'admin' THEN 'admin'
    WHEN lower(trim("role")) = 'security' THEN 'security'
    WHEN lower(trim("role")) = 'legal' THEN 'legal'
    WHEN lower(trim("role")) = 'grc' THEN 'grc'
    ELSE 'user'
END;

-- Preserve the existing column and data while converting it to the enum type.
ALTER TABLE "UserProfile" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "UserProfile" ALTER COLUMN "role" TYPE "UserProfileRole" USING "role"::"UserProfileRole";
ALTER TABLE "UserProfile" ALTER COLUMN "role" SET DEFAULT 'user';
