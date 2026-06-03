-- CreateTable
CREATE TABLE "ChannelAvailabilityBlock" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "connectionId" TEXT,
    "roomId" TEXT,
    "roomTypeId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelAvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelAvailabilityBlock_branchId_startDate_endDate_idx" ON "ChannelAvailabilityBlock"("branchId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "ChannelAvailabilityBlock_connectionId_idx" ON "ChannelAvailabilityBlock"("connectionId");

-- AddForeignKey
ALTER TABLE "ChannelAvailabilityBlock" ADD CONSTRAINT "ChannelAvailabilityBlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAvailabilityBlock" ADD CONSTRAINT "ChannelAvailabilityBlock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAvailabilityBlock" ADD CONSTRAINT "ChannelAvailabilityBlock_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAvailabilityBlock" ADD CONSTRAINT "ChannelAvailabilityBlock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
