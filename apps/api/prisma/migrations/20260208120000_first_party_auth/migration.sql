-- First-party authentication: remove PropelAuth columns, add password + refresh sessions.

ALTER TABLE "User" DROP COLUMN IF EXISTS "propelAuthUserId";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

ALTER TABLE "Organization" DROP COLUMN IF EXISTS "propelAuthOrgId";

CREATE TABLE IF NOT EXISTS "AuthRefreshSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthRefreshSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthRefreshSession_tokenHash_key" ON "AuthRefreshSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "AuthRefreshSession_userId_idx" ON "AuthRefreshSession"("userId");
CREATE INDEX IF NOT EXISTS "AuthRefreshSession_expiresAt_idx" ON "AuthRefreshSession"("expiresAt");

ALTER TABLE "AuthRefreshSession" DROP CONSTRAINT IF EXISTS "AuthRefreshSession_userId_fkey";
ALTER TABLE "AuthRefreshSession" ADD CONSTRAINT "AuthRefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
