/** Format ISO date for display in tables */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/** Format ISO datetime */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

/** Truncate prefixed IDs for compact display */
export function shortId(id: string, visible = 8): string {
  const raw = id.includes("_") ? id.split("_")[1] ?? id : id;
  return raw.length > visible ? `${raw.slice(0, visible)}…` : raw;
}
