-- CreateTable
CREATE TABLE "RatePlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "baseModifier" DECIMAL(8,4) NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateRule" (
    "id" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "minStayNights" INTEGER,
    "pricePerNight" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateRule_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "ratePlanId" TEXT;

-- CreateIndex
CREATE INDEX "RatePlan_organizationId_roomTypeId_validFrom_validTo_idx" ON "RatePlan"("organizationId", "roomTypeId", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "RateRule_ratePlanId_idx" ON "RateRule"("ratePlanId");

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateRule" ADD CONSTRAINT "RateRule_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
