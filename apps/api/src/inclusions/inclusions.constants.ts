export function computeInclusionUnitCost(
  lines: { quantity: unknown; inventoryItem?: { averageUnitCost: unknown } }[],
): number {
  return lines.reduce((sum, line) => {
    const unitCost = Number(line.inventoryItem?.averageUnitCost ?? 0);
    return sum + Number(line.quantity) * unitCost;
  }, 0);
}

/** Calendar nights between check-in and check-out (minimum 1). */
export function countStayNights(checkIn: Date, checkOut: Date): number {
  const start = new Date(checkIn);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setUTCHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diff);
}

export function unitLabelFor(type: string): string {
  return type === "AMENITY_KIT" ? "kits" : "meals";
}
