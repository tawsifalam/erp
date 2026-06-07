import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { TenantScopeModule } from "../common/tenant/tenant-scope.module";
import { InclusionsService } from "./inclusions.service";
import { InclusionsController } from "./inclusions.controller";
import { InclusionsCheckInListener, InclusionsOrderListener } from "./inclusions.listeners";

@Module({
  imports: [InventoryModule, TenantScopeModule],
  controllers: [InclusionsController],
  providers: [InclusionsService, InclusionsCheckInListener, InclusionsOrderListener],
  exports: [InclusionsService],
})
export class InclusionsModule {}
