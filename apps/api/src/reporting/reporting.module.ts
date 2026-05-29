import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ReportingController } from "./reporting.controller";
import { ReportingService } from "./reporting.service";
import { ReportsProcessor } from "./reports.processor";
import { ReportGeneratorsService } from "./report-generators.service";
import { InventoryModule } from "../inventory/inventory.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [
    InventoryModule,
    StorageModule,
    BullModule.registerQueue({ name: "reports" }),
  ],
  controllers: [ReportingController],
  providers: [ReportingService, ReportsProcessor, ReportGeneratorsService],
})
export class ReportingModule {}
