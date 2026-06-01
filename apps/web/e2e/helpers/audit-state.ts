/** Mutable audit log for Playwright API mocks (reset per test via resetAuditState). */

import type { AuditListQuery } from "./audit-types";

export type MockAuditLog = {
  id: string;
  organizationId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null } | null;
};

export const E2E_ORG_ID = "org-test-001";
export const E2E_ACTOR_USER_ID = "usr-e2e-admin";

const E2E_ACTOR_USER = {
  id: E2E_ACTOR_USER_ID,
  email: "admin@boulevard.cafe",
  name: "admin",
};

let logs: MockAuditLog[] = [];

export function resetAuditState() {
  logs = [];
}

export function recordAudit(input: {
  organizationId?: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const entry: MockAuditLog = {
    id: `aud_${String(logs.length + 1).padStart(4, "0")}`,
    organizationId: input.organizationId ?? E2E_ORG_ID,
    userId: input.userId ?? E2E_ACTOR_USER_ID,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? null,
    createdAt: new Date().toISOString(),
    user: E2E_ACTOR_USER,
  };
  logs.unshift(entry);
}

export function listAuditLogs(organizationId: string, query: AuditListQuery = {}) {
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
  let filtered = logs.filter((l) => l.organizationId === organizationId);

  if (query.entityType) {
    filtered = filtered.filter((l) => l.entityType === query.entityType);
  }
  if (query.userId) {
    filtered = filtered.filter((l) => l.userId === query.userId);
  }
  if (query.from) {
    const from = new Date(query.from);
    if (!Number.isNaN(from.getTime())) {
      filtered = filtered.filter((l) => new Date(l.createdAt) >= from);
    }
  }
  if (query.to) {
    const to = new Date(query.to);
    if (!Number.isNaN(to.getTime())) {
      filtered = filtered.filter((l) => new Date(l.createdAt) <= to);
    }
  }

  return filtered.slice(0, limit);
}
