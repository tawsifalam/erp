/** Inclusive period bounds at UTC calendar-day granularity. */
export function periodContainsDate(
  period: { startDate: Date; endDate: Date },
  entryDate: Date,
): boolean {
  const day = utcDayStart(entryDate);
  const start = utcDayStart(period.startDate);
  const end = utcDayStart(period.endDate);
  return day >= start && day <= end;
}

export function utcDayStart(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function periodsOverlap(
  a: { startDate: Date; endDate: Date },
  b: { startDate: Date; endDate: Date },
): boolean {
  const aStart = utcDayStart(a.startDate);
  const aEnd = utcDayStart(a.endDate);
  const bStart = utcDayStart(b.startDate);
  const bEnd = utcDayStart(b.endDate);
  return aStart <= bEnd && bStart <= aEnd;
}
