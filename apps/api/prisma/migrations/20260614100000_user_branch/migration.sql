-- CreateTable
CREATE TABLE "UserBranch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "grantedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBranch_userId_branchId_key" ON "UserBranch"("userId", "branchId");

-- CreateIndex
CREATE INDEX "UserBranch_branchId_status_idx" ON "UserBranch"("branchId", "status");

-- CreateIndex
CREATE INDEX "UserBranch_organizationId_userId_idx" ON "UserBranch"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing org members get ACTIVE access to all branches in their org
INSERT INTO "UserBranch" ("id", "organizationId", "userId", "branchId", "status", "createdAt", "updatedAt", "approvedAt")
SELECT
    'ubr_' || gen_random_uuid()::text,
    b."organizationId",
    uo."userId",
    b."id",
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "UserOrganization" uo
JOIN "Branch" b ON b."organizationId" = uo."organizationId"
ON CONFLICT ("userId", "branchId") DO NOTHING;
