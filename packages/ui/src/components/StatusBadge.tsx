import { Badge } from "@chakra-ui/react";

const COLORS: Record<string, string> = {
  VACANT: "green",
  OCCUPIED: "blue",
  DIRTY: "orange",
  MAINTENANCE: "red",
  CONFIRMED: "blue",
  CHECKED_IN: "green",
  CHECKED_OUT: "gray",
  CANCELLED: "red",
  DRAFT: "gray",
  SUBMITTED: "blue",
  PREPARING: "orange",
  READY: "teal",
  COMPLETED: "green",
  UNPAID: "red",
  PAID: "green",
  PENDING: "gray",
  PROCESSING: "orange",
  FAILED: "red",
  ACTIVE: "green",
  TERMINATED: "gray",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge colorPalette={COLORS[status] ?? "gray"}>{status}</Badge>;
}
