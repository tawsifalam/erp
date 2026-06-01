export function computeStaffMealUnitCost(
  lines: { quantity: unknown; inventoryItem?: { averageUnitCost: unknown } }[],
): number {
  return lines.reduce((sum, line) => {
    const unitCost = Number(line.inventoryItem?.averageUnitCost ?? 0);
    return sum + Number(line.quantity) * unitCost;
  }, 0);
}
