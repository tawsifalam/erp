-- Organization-scoped inventory pools (text code, not enum).

CREATE TABLE "InventoryPool" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryPool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryPool_organizationId_code_key" ON "InventoryPool"("organizationId", "code");

ALTER TABLE "InventoryPool" ADD CONSTRAINT "InventoryPool_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default guest + staff pools per organization
INSERT INTO "InventoryPool" ("id", "organizationId", "code", "name", "isActive", "isSystem", "sortOrder")
SELECT
    'ivp_' || gen_random_uuid()::text,
    o."id",
    'guest',
    'Guest / Kitchen',
    true,
    true,
    0
FROM "Organization" o;

INSERT INTO "InventoryPool" ("id", "organizationId", "code", "name", "isActive", "isSystem", "sortOrder")
SELECT
    'ivp_' || gen_random_uuid()::text,
    o."id",
    'staff',
    'Staff pantry',
    true,
    true,
    1
FROM "Organization" o;

ALTER TABLE "InventoryItem" ADD COLUMN "poolId" TEXT;

UPDATE "InventoryItem" i
SET "poolId" = p."id"
FROM "Branch" b
JOIN "InventoryPool" p ON p."organizationId" = b."organizationId" AND p."code" = 'guest'
WHERE i."branchId" = b."id";

ALTER TABLE "InventoryItem" ALTER COLUMN "poolId" SET NOT NULL;

ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "InventoryPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
