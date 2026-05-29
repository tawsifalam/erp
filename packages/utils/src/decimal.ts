export function toNumber(value: { toString(): string } | number | string): number {
  return typeof value === "number" ? value : Number(value.toString());
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
