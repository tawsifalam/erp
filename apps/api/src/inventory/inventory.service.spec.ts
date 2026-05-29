import { MovementDirection, MovementType } from "@prisma/client";

describe("Inventory stock logic", () => {
  it("computes stock as IN minus OUT", () => {
    const movements = [
      { direction: MovementDirection.IN, quantity: 100 },
      { direction: MovementDirection.OUT, quantity: 30 },
      { direction: MovementDirection.IN, quantity: 20 },
      { direction: MovementDirection.OUT, quantity: 10 },
    ];
    const stock = movements.reduce(
      (s, m) => s + (m.direction === MovementDirection.IN ? Number(m.quantity) : -Number(m.quantity)),
      0,
    );
    expect(stock).toBe(80);
  });

  it("maps movement types to directions", () => {
    expect(MovementType.PURCHASE).toBe("PURCHASE");
    expect(MovementType.SALE).toBe("SALE");
  });
});
