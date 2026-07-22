-- Rename Role.EnterpriseClient -> Role.Client, remapping existing rows
-- (straight ::text::Role_new cast would fail for any row still holding the
-- old label, since it no longer exists in the new enum).
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('Student', 'Mentor', 'SuperAdmin', 'Client');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE WHEN "role"::text = 'EnterpriseClient' THEN 'Client' ELSE "role"::text END::"Role_new"
);
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'Student';
COMMIT;

-- Self-service password reset tokens
ALTER TABLE "users" ADD COLUMN "passwordResetToken" TEXT,
ADD COLUMN "passwordResetTokenExpires" TIMESTAMP(3);
CREATE UNIQUE INDEX "users_passwordResetToken_key" ON "users"("passwordResetToken");
