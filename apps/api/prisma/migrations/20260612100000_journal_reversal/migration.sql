-- Phase 2: journal entry reversal links

ALTER TABLE "JournalEntry" ADD COLUMN "reversesEntryId" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN "reversedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "JournalEntry_reversesEntryId_key" ON "JournalEntry"("reversesEntryId");

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversesEntryId_fkey" FOREIGN KEY ("reversesEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
