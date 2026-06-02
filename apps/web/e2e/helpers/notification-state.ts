/** Mutable in-app notifications for Playwright API mocks (reset per test). */

import { E2E_ACTOR_USER_ID, E2E_ORG_ID } from "./audit-state";
import { resolveNotificationChannels } from "./notification-preference-state";

export type MockNotification = {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const INITIAL: MockNotification[] = [
  {
    id: "ntf_seed_1",
    organizationId: E2E_ORG_ID,
    userId: E2E_ACTOR_USER_ID,
    type: "REPORT_READY",
    title: "Report ready",
    body: "Your Branch summary export is ready to download.",
    link: "/reports",
    readAt: null,
    createdAt: "2026-05-30T10:00:00Z",
  },
  {
    id: "ntf_seed_2",
    organizationId: E2E_ORG_ID,
    userId: E2E_ACTOR_USER_ID,
    type: "LOW_STOCK",
    title: "Low stock alert",
    body: "Olive Oil (OIL-OLV-5L) is at 8.00 L (threshold 10)",
    link: "/inventory",
    readAt: null,
    createdAt: "2026-05-30T11:00:00Z",
  },
  {
    id: "ntf_seed_read",
    organizationId: E2E_ORG_ID,
    userId: E2E_ACTOR_USER_ID,
    type: "PAYROLL_COMPLETED",
    title: "Payroll completed",
    body: "Payroll for 2026-05-01 – 2026-05-31 has been processed.",
    link: "/hr",
    readAt: "2026-05-29T12:00:00Z",
    createdAt: "2026-05-29T11:00:00Z",
  },
];

let notifications = structuredClone(INITIAL) as MockNotification[];

export function resetNotificationState() {
  notifications = structuredClone(INITIAL) as MockNotification[];
}

export { resetNotificationPreferenceState } from "./notification-preference-state";

export function recordNotification(input: {
  organizationId?: string;
  userId?: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
}) {
  const organizationId = input.organizationId ?? E2E_ORG_ID;
  const userId = input.userId ?? E2E_ACTOR_USER_ID;
  const channels = resolveNotificationChannels(organizationId, userId, input.type);
  if (!channels.inApp) return null;

  const entry: MockNotification = {
    id: `ntf_${notifications.length + 1}`,
    organizationId,
    userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
  notifications.unshift(entry);
  return entry;
}

export function listNotifications(organizationId: string, userId: string, limit = 50) {
  const take = Math.min(Math.max(limit, 1), 100);
  return notifications
    .filter((n) => n.organizationId === organizationId && n.userId === userId)
    .slice(0, take);
}

export function unreadNotificationCount(organizationId: string, userId: string) {
  return notifications.filter(
    (n) => n.organizationId === organizationId && n.userId === userId && !n.readAt,
  ).length;
}

export function markNotificationRead(
  organizationId: string,
  userId: string,
  id: string,
): MockNotification | null {
  const row = notifications.find(
    (n) => n.id === id && n.organizationId === organizationId && n.userId === userId,
  );
  if (!row) return null;
  if (!row.readAt) row.readAt = new Date().toISOString();
  return { ...row };
}

export function markAllNotificationsRead(organizationId: string, userId: string) {
  const now = new Date().toISOString();
  for (const n of notifications) {
    if (n.organizationId === organizationId && n.userId === userId && !n.readAt) {
      n.readAt = now;
    }
  }
}
