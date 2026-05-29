/** Phase 1 placeholder unit cost per inventory unit (same as COGS estimate). */
export const STAFF_MEAL_UNIT_COST = 1;

export function computeStaffMealUnitCost(
  lines: { quantity: unknown }[],
): number {
  return lines.reduce(
    (sum, line) => sum + Number(line.quantity) * STAFF_MEAL_UNIT_COST,
    0,
  );
}
