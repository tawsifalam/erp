import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ReservationPaymentEvent } from "./reservation-payment.event";
import { ReservationCheckedOutEvent } from "./reservation-checked-out.event";
import { AccountingListenersService } from "../../accounting/accounting-listeners.service";

@Injectable()
export class PmsEventsListener {
  constructor(private readonly accounting: AccountingListenersService) {}

  @OnEvent("reservation.payment_recorded")
  async handlePayment(event: ReservationPaymentEvent) {
    if (event.deltaPaid <= 0) return;
    await this.accounting.postRoomPayment(
      event.organizationId,
      event.reservationId,
      event.deltaPaid,
    );
  }

  @OnEvent("reservation.checked_out")
  async handleCheckOut(event: ReservationCheckedOutEvent) {
    if (event.unpaidAmount <= 0) return;
    await this.accounting.postRoomReceivable(
      event.organizationId,
      event.reservationId,
      event.unpaidAmount,
    );
  }
}
