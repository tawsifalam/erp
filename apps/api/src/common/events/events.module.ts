import { Module } from "@nestjs/common";
import { OrderEventsListener } from "./order-events.listener";
import { PmsEventsListener } from "./pms-events.listener";
import { InventoryModule } from "../../inventory/inventory.module";
import { AccountingModule } from "../../accounting/accounting.module";

@Module({
  imports: [InventoryModule, AccountingModule],
  providers: [OrderEventsListener, PmsEventsListener],
})
export class EventsModule {}
