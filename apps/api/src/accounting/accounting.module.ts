import { Module } from "@nestjs/common";
import { AccountingController } from "./accounting.controller";
import { AccountingService } from "./accounting.service";
import { AccountingListenersService } from "./accounting-listeners.service";

@Module({
  controllers: [AccountingController],
  providers: [AccountingService, AccountingListenersService],
  exports: [AccountingService, AccountingListenersService],
})
export class AccountingModule {}
