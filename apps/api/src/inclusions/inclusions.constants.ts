/** Phase 1 placeholder unit cost per inventory unit (same as staff meals / COGS). */
export const INCLUSION_UNIT_COST = 1;

export function computeInclusionUnitCost(
  lines: { quantity: unknown }[],
): number {
  return lines.reduce(
    (sum, line) => sum + Number(line.quantity) * INCLUSION_UNIT_COST,
    0,
  );
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
