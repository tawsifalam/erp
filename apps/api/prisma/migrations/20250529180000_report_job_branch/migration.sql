-- Report jobs: branch scope and failure tracking.

ALTER TABLE "ReportJob" ADD COLUMN "branchId" TEXT;
ALTER TABLE "ReportJob" ADD COLUMN "errorMessage" TEXT;

ALTER TABLE "ReportJob" ADD CONSTRAINT "ReportJob_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
