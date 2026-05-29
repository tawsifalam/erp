import { Module } from "@nestjs/common";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";
import { InventoryModule } from "../inventory/inventory.module";

@Module({
  imports: [InventoryModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
