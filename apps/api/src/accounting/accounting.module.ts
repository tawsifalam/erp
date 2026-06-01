import { Module } from "@nestjs/common";
import { AccountingController } from "./accounting.controller";
import { AccountingService } from "./accounting.service";
import { AccountingListenersService } from "./accounting-listeners.service";
import { PayrollJournalService } from "./payroll-journal.service";

@Module({
  controllers: [AccountingController],
  providers: [AccountingService, AccountingListenersService, PayrollJournalService],
  exports: [AccountingService, AccountingListenersService, PayrollJournalService],
})
export class AccountingModule {}
