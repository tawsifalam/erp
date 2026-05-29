import { Module } from "@nestjs/common";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { InventoryRecipesService } from "./inventory-recipes.service";
import { InventoryPoolsService } from "./inventory-pools.service";

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, InventoryRecipesService, InventoryPoolsService],
  exports: [InventoryService, InventoryRecipesService, InventoryPoolsService],
})
export class InventoryModule {}
