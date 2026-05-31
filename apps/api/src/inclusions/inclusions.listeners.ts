import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ReservationCheckedInEvent } from "../common/events/reservation-checked-in.event";
import { OrderCompletedEvent } from "../common/events/order-completed.event";
import { InclusionsService } from "./inclusions.service";

@Injectable()
export class InclusionsCheckInListener {
  constructor(private readonly inclusions: InclusionsService) {}

  @OnEvent("reservation.checked_in")
  async handle(event: ReservationCheckedInEvent) {
    await this.inclusions.snapshotAllowances(event.reservationId);
    await this.inclusions.autoIssueCheckInInclusions(event.reservationId);
  }
}

@Injectable()
export class InclusionsOrderListener {
  constructor(private readonly inclusions: InclusionsService) {}

  @OnEvent("order.completed")
  async handle(event: OrderCompletedEvent) {
    await this.inclusions.consumeFromOrder(event.orderId, event.branchId);
  }
}
