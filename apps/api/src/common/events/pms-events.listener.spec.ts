import { Test, TestingModule } from "@nestjs/testing";
import { PmsEventsListener } from "./pms-events.listener";
import { AccountingListenersService } from "../../accounting/accounting-listeners.service";
import { ReservationPaymentEvent } from "./reservation-payment.event";
import { ReservationCheckedOutEvent } from "./reservation-checked-out.event";

const mockAccounting = {
  postRoomPayment: jest.fn(),
  postRoomReceivable: jest.fn(),
};

describe("PmsEventsListener", () => {
  let listener: PmsEventsListener;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PmsEventsListener,
        { provide: AccountingListenersService, useValue: mockAccounting },
      ],
    }).compile();
    listener = module.get(PmsEventsListener);
  });

  it("posts room payment journal when delta > 0", async () => {
    await listener.handlePayment(
      new ReservationPaymentEvent("org-1", "res-1", 2500),
    );

    expect(mockAccounting.postRoomPayment).toHaveBeenCalledWith(
      "org-1",
      "res-1",
      2500,
    );
  });

  it("skips payment journal when delta is zero", async () => {
    await listener.handlePayment(
      new ReservationPaymentEvent("org-1", "res-1", 0),
    );

    expect(mockAccounting.postRoomPayment).not.toHaveBeenCalled();
  });

  it("posts receivable journal on check-out balance", async () => {
    await listener.handleCheckOut(
      new ReservationCheckedOutEvent("org-1", "res-1", 1500),
    );

    expect(mockAccounting.postRoomReceivable).toHaveBeenCalledWith(
      "org-1",
      "res-1",
      1500,
    );
  });

  it("skips receivable journal when fully paid", async () => {
    await listener.handleCheckOut(
      new ReservationCheckedOutEvent("org-1", "res-1", 0),
    );

    expect(mockAccounting.postRoomReceivable).not.toHaveBeenCalled();
  });
});
