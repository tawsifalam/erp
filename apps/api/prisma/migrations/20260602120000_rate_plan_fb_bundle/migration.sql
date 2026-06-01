-- Rate plan optional room + F&B bundle (links to InclusionPackage)
ALTER TABLE "RatePlan" ADD COLUMN "inclusionPackageId" TEXT;
ALTER TABLE "RatePlan" ADD COLUMN "fbSupplementPerGuestPerNight" DECIMAL(12,2);

ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_inclusionPackageId_fkey"
  FOREIGN KEY ("inclusionPackageId") REFERENCES "InclusionPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "RatePlan_inclusionPackageId_idx" ON "RatePlan"("inclusionPackageId");
