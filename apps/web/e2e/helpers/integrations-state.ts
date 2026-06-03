/** Integration connections and webhooks for Playwright API mocks. */

import { getTenantBranches } from "./tenant-state";
import { getPmsRooms, handlePmsReservationMutation } from "./pms-state";

const CHANNEL_KEYS = new Set(["channel_manager", "ota_inquiry"]);

export type MockIntegrationAdapter = {
  key: string;
  name: string;
  description: string;
  credentialFields: { key: string; label: string; secret?: boolean; required?: boolean }[];
  supportedEvents: string[];
};

export type MockIntegrationConnection = {
  id: string;
  organizationId: string;
  branchId: string | null;
  branchName: string | null;
  adapterKey: string;
  adapterName: string;
  name: string;
  status: string;
  webhookUrl: string;
  webhookSecret: string;
  webhookSecretPreview: string;
  credentialsMasked: Record<string, string>;
  config: null;
  createdAt: string;
  updatedAt: string;
};

export type MockWebhookEvent = {
  id: string;
  connectionId: string;
  organizationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

const ADAPTERS: MockIntegrationAdapter[] = [
  {
    key: "generic_webhook",
    name: "Generic webhook",
    description: "Log arbitrary JSON payloads.",
    credentialFields: [],
    supportedEvents: ["*"],
  },
  {
    key: "channel_manager",
    name: "Channel manager",
    description: "Export availability and import INQUIRY bookings.",
    credentialFields: [
      { key: "partnerId", label: "Partner ID" },
      { key: "apiKey", label: "API key", secret: true },
    ],
    supportedEvents: ["booking.import"],
  },
  {
    key: "ota_inquiry",
    name: "OTA inquiry (legacy)",
    description: "Alias for channel manager.",
    credentialFields: [
      { key: "partnerId", label: "Partner ID" },
      { key: "apiKey", label: "API key", secret: true },
    ],
    supportedEvents: ["booking.import"],
  },
];

type MockAvailabilityBlock = {
  id: string;
  connectionId: string;
  branchId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  roomId: string | null;
};

let connections: MockIntegrationConnection[] = [];
let webhookEvents: MockWebhookEvent[] = [];
let availabilityBlocks: MockAvailabilityBlock[] = [];
let nextConn = 1;
let nextEvent = 1;
let nextBlock = 1;

export function resetIntegrationsState() {
  connections = [];
  webhookEvents = [];
  availabilityBlocks = [];
  nextConn = 1;
  nextEvent = 1;
  nextBlock = 1;
}

function previewSecret(secret: string) {
  return secret.length > 8 ? `••••${secret.slice(-6)}` : "••••••••";
}

function webhookUrl(id: string) {
  return `http://localhost:3001/api/integrations/webhooks/${id}`;
}

export function listIntegrationAdapters() {
  return ADAPTERS;
}

export function listIntegrationConnections(orgId: string) {
  return connections.filter((c) => c.organizationId === orgId);
}

export function createIntegrationConnection(
  orgId: string,
  body: {
    adapterKey: string;
    name: string;
    branchId?: string | null;
    credentials?: Record<string, string>;
  },
) {
  const adapter = ADAPTERS.find((a) => a.key === body.adapterKey);
  if (!adapter) return { status: 400, message: `Unknown adapter: ${body.adapterKey}` };
  const name = body.name?.trim();
  if (!name) return { status: 400, message: "name is required" };

  const branches = getTenantBranches();
  const branch = body.branchId ? branches.find((b) => b.id === body.branchId) : undefined;
  if (body.branchId && !branch) {
    return { status: 400, message: "branchId does not belong to this organization" };
  }

  const id = `int-e2e-${nextConn++}`;
  const webhookSecret = `whsec_e2e_${id}`;
  const masked: Record<string, string> = {};
  for (const field of adapter.credentialFields) {
    const val = body.credentials?.[field.key];
    if (!val) continue;
    masked[field.key] = field.secret ? previewSecret(val) : val;
  }

  const row: MockIntegrationConnection = {
    id,
    organizationId: orgId,
    branchId: body.branchId ?? null,
    branchName: branch?.name ?? null,
    adapterKey: body.adapterKey,
    adapterName: adapter.name,
    name,
    status: "ACTIVE",
    webhookUrl: webhookUrl(id),
    webhookSecret,
    webhookSecretPreview: previewSecret(webhookSecret),
    credentialsMasked: masked,
    config: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  connections.push(row);
  return { ...row, webhookSecret };
}

export function updateIntegrationConnection(
  orgId: string,
  id: string,
  body: { name?: string; status?: string },
) {
  const row = connections.find((c) => c.id === id && c.organizationId === orgId);
  if (!row) return { status: 404, message: "Integration connection not found" };
  if (body.name) row.name = body.name.trim();
  if (body.status) row.status = body.status;
  row.updatedAt = new Date().toISOString();
  return row;
}

export function deleteIntegrationConnection(orgId: string, id: string) {
  const idx = connections.findIndex((c) => c.id === id && c.organizationId === orgId);
  if (idx < 0) return { status: 404, message: "Integration connection not found" };
  connections.splice(idx, 1);
  webhookEvents = webhookEvents.filter((e) => e.connectionId !== id);
  return { ok: true };
}

export function rotateIntegrationSecret(orgId: string, id: string) {
  const row = connections.find((c) => c.id === id && c.organizationId === orgId);
  if (!row) return { status: 404, message: "Integration connection not found" };
  row.webhookSecret = `whsec_e2e_rotated_${id}`;
  row.webhookSecretPreview = previewSecret(row.webhookSecret);
  return { webhookSecret: row.webhookSecret, webhookSecretPreview: row.webhookSecretPreview };
}

export function listWebhookEvents(orgId: string, connectionId: string) {
  const conn = connections.find((c) => c.id === connectionId && c.organizationId === orgId);
  if (!conn) return { status: 404, message: "Integration connection not found" };
  return webhookEvents
    .filter((e) => e.connectionId === connectionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);
}

export function handleIntegrationWebhook(
  connectionId: string,
  secret: string | undefined,
  body: Record<string, unknown>,
) {
  const conn = connections.find((c) => c.id === connectionId);
  if (!conn) return { status: 404, message: "Integration connection not found" };
  if (conn.status !== "ACTIVE") return { status: 400, message: "Integration connection is disabled" };
  if (!secret || secret !== conn.webhookSecret) {
    return { status: 401, message: "Invalid webhook secret" };
  }

  const eventType = typeof body.event === "string" ? body.event : "unknown";
  const eventId = `iwe-e2e-${nextEvent++}`;
  let status = "PROCESSED";
  let errorMessage: string | null = null;

  try {
    if (CHANNEL_KEYS.has(conn.adapterKey) && eventType === "booking.import") {
      if (!conn.branchId) throw new Error("OTA inquiry connection requires a branch");
      const roomId = typeof body.roomId === "string" ? body.roomId : undefined;
      const checkIn = typeof body.checkIn === "string" ? body.checkIn : undefined;
      const checkOut = typeof body.checkOut === "string" ? body.checkOut : undefined;
      if (!roomId || !checkIn || !checkOut) {
        throw new Error("booking.import requires roomId, checkIn, and checkOut");
      }
      handlePmsReservationMutation("POST", "http://localhost:3001/api/pms/reservations", {
        guestId: "gst_001",
        roomId,
        checkIn,
        checkOut,
        status: "INQUIRY",
      });
    } else if (CHANNEL_KEYS.has(conn.adapterKey) && eventType !== "booking.import") {
      throw new Error(`Unsupported event for channel adapter: ${eventType}`);
    }
  } catch (err) {
    status = "FAILED";
    errorMessage = err instanceof Error ? err.message : String(err);
    webhookEvents.unshift({
      id: eventId,
      connectionId,
      organizationId: conn.organizationId,
      eventType,
      payload: body,
      status,
      errorMessage,
      createdAt: new Date().toISOString(),
    });
    return { status: 400, message: errorMessage };
  }

  webhookEvents.unshift({
    id: eventId,
    connectionId,
    organizationId: conn.organizationId,
    eventType,
    payload: body,
    status,
    errorMessage,
    createdAt: new Date().toISOString(),
  });

  return { ok: true, eventId, status };
}

export function handleIntegrationsMutation(
  method: string,
  url: string,
  orgId: string,
  body?: Record<string, unknown>,
): unknown {
  const pathname = new URL(url).pathname;

  if (pathname.endsWith("/integrations/health") && method === "GET") {
    return { status: "ok", adapters: ADAPTERS.length, message: "Integrations platform" };
  }

  if (pathname.endsWith("/integrations/adapters") && method === "GET") {
    return listIntegrationAdapters();
  }

  if (pathname.endsWith("/integrations/connections") && method === "GET") {
    return listIntegrationConnections(orgId);
  }

  if (pathname.endsWith("/integrations/connections") && method === "POST") {
    return createIntegrationConnection(orgId, body as Parameters<typeof createIntegrationConnection>[1]);
  }

  const connMatch = pathname.match(/\/integrations\/connections\/([^/]+)$/);
  if (connMatch) {
    const id = connMatch[1];
    if (method === "PATCH") {
      return updateIntegrationConnection(orgId, id, body as { name?: string; status?: string });
    }
    if (method === "DELETE") {
      return deleteIntegrationConnection(orgId, id);
    }
  }

  const rotateMatch = pathname.match(/\/integrations\/connections\/([^/]+)\/rotate-secret$/);
  if (rotateMatch && method === "POST") {
    return rotateIntegrationSecret(orgId, rotateMatch[1]);
  }

  const eventsMatch = pathname.match(/\/integrations\/connections\/([^/]+)\/webhook-events$/);
  if (eventsMatch && method === "GET") {
    return listWebhookEvents(orgId, eventsMatch[1]);
  }

  const exportMatch =
    method === "GET" && pathname.includes("/integrations/connections/") && pathname.endsWith("/availability-export")
      ? pathname.match(/\/integrations\/connections\/([^/]+)\/availability-export/)
      : null;
  if (exportMatch) {
    const parsed = new URL(url);
    return exportAvailability(
      orgId,
      exportMatch[1],
      parsed.searchParams.get("from") ?? "",
      parsed.searchParams.get("to") ?? "",
    );
  }

  const blocksListMatch = pathname.match(/\/integrations\/connections\/([^/]+)\/availability-blocks$/);
  if (blocksListMatch && method === "GET") {
    return listAvailabilityBlocks(orgId, blocksListMatch[1]);
  }
  if (blocksListMatch && method === "POST") {
    return createAvailabilityBlock(orgId, blocksListMatch[1], body as { startDate: string; endDate: string; reason?: string });
  }

  const blockDeleteMatch = pathname.match(
    /\/integrations\/connections\/([^/]+)\/availability-blocks\/([^/]+)$/,
  );
  if (blockDeleteMatch && method === "DELETE") {
    return deleteAvailabilityBlock(orgId, blockDeleteMatch[1], blockDeleteMatch[2]);
  }

  return { status: 404, message: "Not found" };
}

function requireChannelConnection(orgId: string, connectionId: string) {
  const conn = connections.find((c) => c.id === connectionId && c.organizationId === orgId);
  if (!conn) return { status: 404, message: "Integration connection not found" };
  if (!CHANNEL_KEYS.has(conn.adapterKey)) {
    return { status: 400, message: "Connection adapter does not support channel manager" };
  }
  if (!conn.branchId) return { status: 400, message: "Channel manager requires a branch on the connection" };
  return conn;
}

function exportAvailability(orgId: string, connectionId: string, from: string, to: string) {
  const conn = requireChannelConnection(orgId, connectionId);
  if ("status" in conn) return conn;
  const rooms = getPmsRooms();
  const byType = new Map<string, { roomTypeName: string; totalRooms: number }>();
  for (const room of rooms) {
    const name = room.roomType?.name ?? "Room";
    const cur = byType.get(room.roomTypeId) ?? { roomTypeName: name, totalRooms: 0 };
    cur.totalRooms += 1;
    byType.set(room.roomTypeId, cur);
  }
  const nights: string[] = [];
  if (from && to) {
    const cur = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    while (cur < end) {
      nights.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return {
    connectionId,
    branchId: conn.branchId,
    from,
    to,
    exportedAt: new Date().toISOString(),
    roomTypes: [...byType.entries()].map(([roomTypeId, meta]) => ({
      roomTypeId,
      roomTypeName: meta.roomTypeName,
      inventory: nights.map((date) => ({
        date,
        totalRooms: meta.totalRooms,
        availableCount: meta.totalRooms,
        blockedCount: 0,
      })),
    })),
  };
}

function listAvailabilityBlocks(orgId: string, connectionId: string) {
  const conn = requireChannelConnection(orgId, connectionId);
  if ("status" in conn) return conn;
  return availabilityBlocks
    .filter((b) => b.connectionId === connectionId)
    .map((b) => ({
      id: b.id,
      branchId: b.branchId,
      connectionId: b.connectionId,
      roomId: b.roomId,
      roomTypeId: null,
      startDate: b.startDate,
      endDate: b.endDate,
      reason: b.reason,
      createdAt: new Date().toISOString(),
    }));
}

function createAvailabilityBlock(
  orgId: string,
  connectionId: string,
  body: { startDate: string; endDate: string; reason?: string },
) {
  const conn = requireChannelConnection(orgId, connectionId);
  if ("status" in conn) return conn;
  const id = `cab-e2e-${nextBlock++}`;
  availabilityBlocks.push({
    id,
    connectionId,
    branchId: conn.branchId!,
    startDate: body.startDate,
    endDate: body.endDate,
    reason: body.reason ?? null,
    roomId: null,
  });
  return {
    id,
    branchId: conn.branchId,
    connectionId,
    roomId: null,
    roomTypeId: null,
    startDate: body.startDate,
    endDate: body.endDate,
    reason: body.reason ?? null,
    createdAt: new Date().toISOString(),
  };
}

function deleteAvailabilityBlock(orgId: string, connectionId: string, blockId: string) {
  const conn = requireChannelConnection(orgId, connectionId);
  if ("status" in conn) return conn;
  const idx = availabilityBlocks.findIndex((b) => b.id === blockId && b.connectionId === connectionId);
  if (idx < 0) return { status: 404, message: "Availability block not found" };
  availabilityBlocks.splice(idx, 1);
  return { ok: true };
}

/** For assertions in E2E */
export function getMockWebhookEvents(connectionId: string) {
  return webhookEvents.filter((e) => e.connectionId === connectionId);
}
