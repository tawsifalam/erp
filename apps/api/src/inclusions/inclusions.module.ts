import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { InclusionsService } from "./inclusions.service";
import { InclusionsController } from "./inclusions.controller";
import { InclusionsCheckInListener, InclusionsOrderListener } from "./inclusions.listeners";

@Module({
  imports: [InventoryModule],
  controllers: [InclusionsController],
  providers: [InclusionsService, InclusionsCheckInListener, InclusionsOrderListener],
  exports: [InclusionsService],
})
export class InclusionsModule {}
