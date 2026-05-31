-- Guest Inclusions Engine: packages, recipes, allowances, reservation headcount, POS link

ALTER TABLE "Reservation" ADD COLUMN "adultCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Reservation" ADD COLUMN "childCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN "packageId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "mealsPerGuestPerNightOverride" INTEGER;

ALTER TABLE "MenuItem" ADD COLUMN "isGuestInclusionMeal" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order" ADD COLUMN "reservationId" TEXT;

CREATE TABLE "InclusionRecipe" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inclusionType" TEXT NOT NULL,

    CONSTRAINT "InclusionRecipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InclusionRecipeLine" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "InclusionRecipeLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InclusionPackage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InclusionPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InclusionPackageRule" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "inclusionType" TEXT NOT NULL,
    "inclusionRecipeId" TEXT NOT NULL,
    "quantityPerGuestPerNight" INTEGER,
    "quantityPerGuestPerStay" INTEGER,
    "autoIssueOnCheckIn" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InclusionPackageRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReservationAllowance" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "inclusionType" TEXT NOT NULL,
    "inclusionRecipeId" TEXT NOT NULL,
    "entitledQty" INTEGER NOT NULL,
    "consumedQty" INTEGER NOT NULL DEFAULT 0,
    "unitLabel" TEXT NOT NULL,

    CONSTRAINT "ReservationAllowance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InclusionConsumption" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "allowanceId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InclusionConsumption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InclusionRecipe_branchId_name_key" ON "InclusionRecipe"("branchId", "name");
CREATE UNIQUE INDEX "InclusionPackage_organizationId_name_key" ON "InclusionPackage"("organizationId", "name");
CREATE UNIQUE INDEX "ReservationAllowance_reservationId_inclusionType_inclusionRecipeId_key" ON "ReservationAllowance"("reservationId", "inclusionType", "inclusionRecipeId");

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "InclusionPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InclusionRecipe" ADD CONSTRAINT "InclusionRecipe_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InclusionRecipeLine" ADD CONSTRAINT "InclusionRecipeLine_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "InclusionRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InclusionRecipeLine" ADD CONSTRAINT "InclusionRecipeLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InclusionPackage" ADD CONSTRAINT "InclusionPackage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InclusionPackageRule" ADD CONSTRAINT "InclusionPackageRule_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "InclusionPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InclusionPackageRule" ADD CONSTRAINT "InclusionPackageRule_inclusionRecipeId_fkey" FOREIGN KEY ("inclusionRecipeId") REFERENCES "InclusionRecipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReservationAllowance" ADD CONSTRAINT "ReservationAllowance_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationAllowance" ADD CONSTRAINT "ReservationAllowance_inclusionRecipeId_fkey" FOREIGN KEY ("inclusionRecipeId") REFERENCES "InclusionRecipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InclusionConsumption" ADD CONSTRAINT "InclusionConsumption_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InclusionConsumption" ADD CONSTRAINT "InclusionConsumption_allowanceId_fkey" FOREIGN KEY ("allowanceId") REFERENCES "ReservationAllowance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
