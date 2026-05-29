import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ReportingController } from "./reporting.controller";
import { ReportingService } from "./reporting.service";
import { ReportsProcessor } from "./reports.processor";
import { ReportsListener } from "./reports.listener";
import { StorageModule } from "../storage/storage.module";
import { InventoryModule } from "../inventory/inventory.module";

@Module({
  imports: [InventoryModule, BullModule.registerQueue({ name: "reports" }), StorageModule],
  controllers: [ReportingController],
  providers: [ReportingService, ReportsProcessor, ReportsListener],
})
export class ReportingModule {}
