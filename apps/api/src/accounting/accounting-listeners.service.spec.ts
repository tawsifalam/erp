import { Test, TestingModule } from "@nestjs/testing";
import { AccountingListenersService } from "./accounting-listeners.service";
import { AccountingService } from "./accounting.service";

const mockAccounting = {
  getAccountByCode: jest.fn(),
  createJournalEntry: jest.fn(),
};

describe("AccountingListenersService — PMS folio", () => {
  let service: AccountingListenersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingListenersService,
        { provide: AccountingService, useValue: mockAccounting },
      ],
    }).compile();
    service = module.get(AccountingListenersService);
  });

  it("postRoomPayment creates cash/revenue journal", async () => {
    mockAccounting.getAccountByCode.mockImplementation((_org: string, code: string) => {
      if (code === "1000") return { id: "acc-cash" };
      if (code === "4000") return { id: "acc-room-rev" };
      return null;
    });

    await service.postRoomPayment("org-1", "res-1", 3000);

    expect(mockAccounting.createJournalEntry).toHaveBeenCalledWith({
      organizationId: "org-1",
      referenceType: "Reservation",
      referenceId: "res-1",
      description: "Room payment received",
      lines: [
        { accountId: "acc-cash", debit: 3000, credit: 0 },
        { accountId: "acc-room-rev", debit: 0, credit: 3000 },
      ],
    });
  });

  it("postRoomReceivable creates AR/revenue journal", async () => {
    mockAccounting.getAccountByCode.mockImplementation((_org: string, code: string) => {
      if (code === "1300") return { id: "acc-ar" };
      if (code === "4000") return { id: "acc-room-rev" };
      return null;
    });

    await service.postRoomReceivable("org-1", "res-1", 1200);

    expect(mockAccounting.createJournalEntry).toHaveBeenCalledWith({
      organizationId: "org-1",
      referenceType: "Reservation",
      referenceId: "res-1",
      description: "Room revenue — balance on check-out",
      lines: [
        { accountId: "acc-ar", debit: 1200, credit: 0 },
        { accountId: "acc-room-rev", debit: 0, credit: 1200 },
      ],
    });
  });

  it("postRoomPayment skips when accounts missing", async () => {
    mockAccounting.getAccountByCode.mockResolvedValue(null);

    await service.postRoomPayment("org-1", "res-1", 100);

    expect(mockAccounting.createJournalEntry).not.toHaveBeenCalled();
  });
});

describe("AccountingListenersService — POS folio", () => {
  let service: AccountingListenersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingListenersService,
        { provide: AccountingService, useValue: mockAccounting },
      ],
    }).compile();
    service = module.get(AccountingListenersService);
  });

  it("postFoodSale creates cash/F&B revenue journal", async () => {
    mockAccounting.getAccountByCode.mockImplementation((_org: string, code: string) => {
      if (code === "1000") return { id: "acc-cash" };
      if (code === "4100") return { id: "acc-fb-rev" };
      return null;
    });

    await service.postFoodSale("org-1", "ord-1", 860);

    expect(mockAccounting.createJournalEntry).toHaveBeenCalledWith({
      organizationId: "org-1",
      referenceType: "Order",
      referenceId: "ord-1",
      description: "F&B sale",
      lines: [
        { accountId: "acc-cash", debit: 860, credit: 0 },
        { accountId: "acc-fb-rev", debit: 0, credit: 860 },
      ],
    });
  });

  it("postCogs creates COGS/inventory journal", async () => {
    mockAccounting.getAccountByCode.mockImplementation((_org: string, code: string) => {
      if (code === "5000") return { id: "acc-cogs" };
      if (code === "1200") return { id: "acc-inv" };
      return null;
    });

    await service.postCogs("org-1", "ord-1", 180);

    expect(mockAccounting.createJournalEntry).toHaveBeenCalledWith({
      organizationId: "org-1",
      referenceType: "Order",
      referenceId: "ord-1",
      description: "Inventory consumption",
      lines: [
        { accountId: "acc-cogs", debit: 180, credit: 0 },
        { accountId: "acc-inv", debit: 0, credit: 180 },
      ],
    });
  });
});
