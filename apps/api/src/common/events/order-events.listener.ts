import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { OrderCompletedEvent } from "./order-completed.event";
import { InventoryRecipesService } from "../../inventory/inventory-recipes.service";
import { AccountingListenersService } from "../../accounting/accounting-listeners.service";

@Injectable()
export class OrderEventsListener {
  constructor(
    private readonly recipes: InventoryRecipesService,
    private readonly accounting: AccountingListenersService,
  ) {}

  @OnEvent("order.completed")
  async handleOrderCompleted(event: OrderCompletedEvent) {
    const cogs = await this.recipes.deductForOrder(event.orderId, event.branchId);
    await this.accounting.postFoodSale(event.organizationId, event.orderId, event.totalAmount);
    if (cogs > 0) {
      await this.accounting.postCogs(event.organizationId, event.orderId, cogs);
    }
  }
}
