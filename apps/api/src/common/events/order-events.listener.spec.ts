import { Test, TestingModule } from "@nestjs/testing";
import { OrderCompletedEvent } from "./order-completed.event";
import { OrderEventsListener } from "./order-events.listener";
import { InventoryRecipesService } from "../../inventory/inventory-recipes.service";
import { AccountingListenersService } from "../../accounting/accounting-listeners.service";

const mockRecipes = {
  deductForOrder: jest.fn(),
};

const mockAccounting = {
  postFoodSale: jest.fn(),
  postCogs: jest.fn(),
};

describe("OrderEventsListener", () => {
  let listener: OrderEventsListener;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderEventsListener,
        { provide: InventoryRecipesService, useValue: mockRecipes },
        { provide: AccountingListenersService, useValue: mockAccounting },
      ],
    }).compile();
    listener = module.get(OrderEventsListener);
  });

  it("deducts inventory and posts food sale + COGS", async () => {
    mockRecipes.deductForOrder.mockResolvedValue(180);

    await listener.handleOrderCompleted(
      new OrderCompletedEvent("ord-1", "br-1", "org-1", 690),
    );

    expect(mockRecipes.deductForOrder).toHaveBeenCalledWith("ord-1", "br-1");
    expect(mockAccounting.postFoodSale).toHaveBeenCalledWith("org-1", "ord-1", 690);
    expect(mockAccounting.postCogs).toHaveBeenCalledWith("org-1", "ord-1", 180);
  });

  it("skips COGS journal when deduction returns zero", async () => {
    mockRecipes.deductForOrder.mockResolvedValue(0);

    await listener.handleOrderCompleted(
      new OrderCompletedEvent("ord-1", "br-1", "org-1", 100),
    );

    expect(mockAccounting.postFoodSale).toHaveBeenCalled();
    expect(mockAccounting.postCogs).not.toHaveBeenCalled();
  });
});
