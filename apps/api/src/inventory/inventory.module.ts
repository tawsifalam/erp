import { Module } from "@nestjs/common";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { InventoryRecipesService } from "./inventory-recipes.service";

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, InventoryRecipesService],
  exports: [InventoryService, InventoryRecipesService],
})
export class InventoryModule {}
