import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { ReservationStatus } from "@erp/types";
import { generatePrefixedId } from "@erp/utils";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { PmsService } from "../pms/pms.service";
import {
  getIntegrationAdapter,
  INTEGRATION_ADAPTERS,
  type IntegrationAdapterDefinition,
} from "./integration-adapters.constants";
import {
  IntegrationConnectionStatus,
  IntegrationWebhookEventStatus,
} from "./integration-connection.constants";

export type IntegrationConnectionView = {
  id: string;
  organizationId: string;
  branchId: string | null;
  branchName: string | null;
  adapterKey: string;
  adapterName: string;
  name: string;
  status: string;
  webhookUrl: string;
  webhookSecretPreview: string;
  credentialsMasked: Record<string, string>;
  config: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateIntegrationConnectionResult = IntegrationConnectionView & {
  webhookSecret: string;
};

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pms: PmsService,
  ) {}

  listAdapters() {
    return INTEGRATION_ADAPTERS.map((a) => ({
      key: a.key,
      name: a.name,
      description: a.description,
      credentialFields: a.credentialFields,
      supportedEvents: a.supportedEvents,
    }));
  }

  async listConnections(organizationId: string): Promise<IntegrationConnectionView[]> {
    const rows = await this.prisma.integrationConnection.findMany({
      where: { organizationId },
      include: { branch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toView(row, row.branch?.name ?? null));
  }

  async createConnection(
    organizationId: string,
    userId: string,
    body: {
      adapterKey: string;
      name: string;
      branchId?: string | null;
      credentials?: Record<string, string>;
      config?: Record<string, unknown>;
    },
  ): Promise<CreateIntegrationConnectionResult> {
    const adapter = getIntegrationAdapter(body.adapterKey);
    if (!adapter) {
      throw new BadRequestException(`Unknown adapter: ${body.adapterKey}`);
    }
    const name = body.name?.trim();
    if (!name) throw new BadRequestException("name is required");

    if (body.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: body.branchId, organizationId },
      });
      if (!branch) throw new BadRequestException("branchId does not belong to this organization");
    }

    this.validateCredentials(adapter, body.credentials);

    const webhookSecret = this.generateWebhookSecret();
    const created = await this.prisma.integrationConnection.create({
      data: {
        id: generatePrefixedId("int"),
        organizationId,
        branchId: body.branchId ?? null,
        adapterKey: body.adapterKey,
        name,
        status: IntegrationConnectionStatus.ACTIVE,
        webhookSecret,
        credentialsJson: body.credentials ?? undefined,
        configJson: body.config ?? undefined,
      },
    });

    await this.audit.record({
      organizationId,
      userId,
      action: "integration.connection.create",
      entityType: "integration_connection",
      entityId: created.id,
      metadata: { adapterKey: created.adapterKey, name: created.name },
    });

    const branchName = created.branchId
      ? (
          await this.prisma.branch.findFirst({
            where: { id: created.branchId },
            select: { name: true },
          })
        )?.name ?? null
      : null;
    const view = this.toView(created, branchName);
    return { ...view, webhookSecret };
  }

  async updateConnection(
    organizationId: string,
    userId: string,
    connectionId: string,
    body: {
      name?: string;
      status?: string;
      branchId?: string | null;
      credentials?: Record<string, string>;
      config?: Record<string, unknown>;
    },
  ): Promise<IntegrationConnectionView> {
    const existing = await this.findConnection(organizationId, connectionId);
    const adapter = getIntegrationAdapter(existing.adapterKey);
    if (!adapter) throw new BadRequestException("Invalid adapter on connection");

    if (body.status && !Object.values(IntegrationConnectionStatus).includes(body.status as never)) {
      throw new BadRequestException("Invalid status");
    }
    if (body.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: body.branchId, organizationId },
      });
      if (!branch) throw new BadRequestException("branchId does not belong to this organization");
    }
    if (body.credentials) {
      this.validateCredentials(adapter, body.credentials);
    }

    const updated = await this.prisma.integrationConnection.update({
      where: { id: connectionId },
      data: {
        name: body.name?.trim() || undefined,
        status: body.status,
        branchId: body.branchId === undefined ? undefined : body.branchId,
        credentialsJson: body.credentials ?? undefined,
        configJson: body.config ?? undefined,
      },
    });

    await this.audit.record({
      organizationId,
      userId,
      action: "integration.connection.update",
      entityType: "integration_connection",
      entityId: connectionId,
      metadata: { status: updated.status },
    });

    const branchName = updated.branchId
      ? (
          await this.prisma.branch.findFirst({
            where: { id: updated.branchId },
            select: { name: true },
          })
        )?.name ?? null
      : null;
    return this.toView(updated, branchName);
  }

  async deleteConnection(organizationId: string, userId: string, connectionId: string) {
    await this.findConnection(organizationId, connectionId);
    await this.prisma.integrationConnection.delete({ where: { id: connectionId } });
    await this.audit.record({
      organizationId,
      userId,
      action: "integration.connection.delete",
      entityType: "integration_connection",
      entityId: connectionId,
    });
    return { ok: true };
  }

  async rotateWebhookSecret(
    organizationId: string,
    userId: string,
    connectionId: string,
  ): Promise<{ webhookSecret: string; webhookSecretPreview: string }> {
    await this.findConnection(organizationId, connectionId);
    const webhookSecret = this.generateWebhookSecret();
    const updated = await this.prisma.integrationConnection.update({
      where: { id: connectionId },
      data: { webhookSecret },
    });
    await this.audit.record({
      organizationId,
      userId,
      action: "integration.connection.rotate_secret",
      entityType: "integration_connection",
      entityId: connectionId,
    });
    return {
      webhookSecret,
      webhookSecretPreview: this.previewSecret(updated.webhookSecret),
    };
  }

  async listWebhookEvents(organizationId: string, connectionId: string, limit = 50) {
    await this.findConnection(organizationId, connectionId);
    const parsed = Math.min(Math.max(limit, 1), 100);
    return this.prisma.integrationWebhookEvent.findMany({
      where: { connectionId, organizationId },
      orderBy: { createdAt: "desc" },
      take: parsed,
    });
  }

  async handleWebhook(connectionId: string, secretHeader: string | undefined, body: unknown) {
    const connection = await this.prisma.integrationConnection.findUnique({
      where: { id: connectionId },
      include: { branch: true },
    });
    if (!connection) throw new NotFoundException("Integration connection not found");
    if (connection.status !== IntegrationConnectionStatus.ACTIVE) {
      throw new BadRequestException("Integration connection is disabled");
    }
    if (!secretHeader || secretHeader !== connection.webhookSecret) {
      throw new UnauthorizedException("Invalid webhook secret");
    }

    const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const eventType =
      typeof payload.event === "string" ? payload.event : "unknown";

    const event = await this.prisma.integrationWebhookEvent.create({
      data: {
        id: generatePrefixedId("iwe"),
        connectionId: connection.id,
        organizationId: connection.organizationId,
        eventType,
        payload: payload as object,
        status: IntegrationWebhookEventStatus.RECEIVED,
      },
    });

    try {
      await this.processWebhookEvent(connection, eventType, payload);
      await this.prisma.integrationWebhookEvent.update({
        where: { id: event.id },
        data: { status: IntegrationWebhookEventStatus.PROCESSED },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.integrationWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: IntegrationWebhookEventStatus.FAILED,
          errorMessage: message,
        },
      });
      throw new BadRequestException(message);
    }

    return { ok: true, eventId: event.id, status: IntegrationWebhookEventStatus.PROCESSED };
  }

  health() {
    return {
      status: "ok",
      adapters: INTEGRATION_ADAPTERS.length,
      message: "Integrations platform — adapter registry and webhooks",
    };
  }

  private async processWebhookEvent(
    connection: {
      id: string;
      organizationId: string;
      branchId: string | null;
      adapterKey: string;
    },
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    if (connection.adapterKey === "generic_webhook") {
      return;
    }

    if (connection.adapterKey === "ota_inquiry" && eventType === "booking.import") {
      await this.importOtaInquiry(connection, payload);
      return;
    }

    if (connection.adapterKey === "ota_inquiry") {
      throw new BadRequestException(`Unsupported event for OTA adapter: ${eventType}`);
    }
  }

  private async importOtaInquiry(
    connection: { organizationId: string; branchId: string | null },
    payload: Record<string, unknown>,
  ) {
    const branchId = connection.branchId;
    if (!branchId) {
      throw new BadRequestException("OTA inquiry connection requires a branch");
    }

    const guestPayload = payload.guest as Record<string, unknown> | undefined;
    const roomId = typeof payload.roomId === "string" ? payload.roomId : undefined;
    const checkInRaw = typeof payload.checkIn === "string" ? payload.checkIn : undefined;
    const checkOutRaw = typeof payload.checkOut === "string" ? payload.checkOut : undefined;

    if (!roomId || !checkInRaw || !checkOutRaw) {
      throw new BadRequestException("booking.import requires roomId, checkIn, and checkOut");
    }

    const checkIn = new Date(checkInRaw);
    const checkOut = new Date(checkOutRaw);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      throw new BadRequestException("Invalid checkIn or checkOut date");
    }
    if (checkOut <= checkIn) {
      throw new BadRequestException("checkOut must be after checkIn");
    }

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, branchId },
    });
    if (!room) throw new BadRequestException("roomId not found on connection branch");

    const guest = await this.findOrCreateGuest(connection.organizationId, guestPayload);

    await this.pms.createReservation(
      branchId,
      {
        guestId: guest.id,
        roomId,
        checkIn,
        checkOut,
        status: ReservationStatus.INQUIRY,
        adultCount: typeof payload.adultCount === "number" ? payload.adultCount : 1,
        childCount: typeof payload.childCount === "number" ? payload.childCount : 0,
      },
      undefined,
    );

    await this.audit.record({
      organizationId: connection.organizationId,
      action: "integration.ota.booking_import",
      entityType: "reservation",
      metadata: { branchId, roomId, guestId: guest.id, source: "ota_inquiry" },
    });
  }

  private async findOrCreateGuest(
    organizationId: string,
    guestPayload?: Record<string, unknown>,
  ) {
    const email =
      typeof guestPayload?.email === "string" ? guestPayload.email.trim() : undefined;
    const fullName =
      typeof guestPayload?.fullName === "string" && guestPayload.fullName.trim()
        ? guestPayload.fullName.trim()
        : email
          ? email.split("@")[0]
          : "OTA Guest";
    const phone =
      typeof guestPayload?.phone === "string" ? guestPayload.phone : undefined;

    if (email) {
      const existing = await this.prisma.guest.findFirst({
        where: { organizationId, email },
      });
      if (existing) return existing;
    }

    return this.pms.createGuest(organizationId, { fullName, email, phone });
  }

  private validateCredentials(
    adapter: IntegrationAdapterDefinition,
    credentials?: Record<string, string>,
  ) {
    if (!credentials) return;
    for (const field of adapter.credentialFields) {
      if (field.required && !credentials[field.key]?.trim()) {
        throw new BadRequestException(`Missing credential: ${field.key}`);
      }
    }
  }

  private async findConnection(organizationId: string, connectionId: string) {
    const row = await this.prisma.integrationConnection.findFirst({
      where: { id: connectionId, organizationId },
    });
    if (!row) throw new NotFoundException("Integration connection not found");
    return row;
  }

  private toView(
    row: {
      id: string;
      organizationId: string;
      branchId: string | null;
      adapterKey: string;
      name: string;
      status: string;
      webhookSecret: string;
      credentialsJson: unknown;
      configJson: unknown;
      createdAt: Date;
      updatedAt: Date;
    },
    branchName: string | null,
  ): IntegrationConnectionView {
    const adapter = getIntegrationAdapter(row.adapterKey);
    return {
      id: row.id,
      organizationId: row.organizationId,
      branchId: row.branchId,
      branchName,
      adapterKey: row.adapterKey,
      adapterName: adapter?.name ?? row.adapterKey,
      name: row.name,
      status: row.status,
      webhookUrl: this.buildWebhookUrl(row.id),
      webhookSecretPreview: this.previewSecret(row.webhookSecret),
      credentialsMasked: this.maskCredentials(
        row.adapterKey,
        (row.credentialsJson as Record<string, string> | null) ?? {},
      ),
      config: (row.configJson as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private maskCredentials(adapterKey: string, credentials: Record<string, string>) {
    const adapter = getIntegrationAdapter(adapterKey);
    if (!adapter) return {};
    const out: Record<string, string> = {};
    for (const field of adapter.credentialFields) {
      const val = credentials[field.key];
      if (!val) continue;
      out[field.key] = field.secret ? this.previewSecret(val) : val;
    }
    return out;
  }

  private previewSecret(value: string) {
    if (value.length <= 8) return "••••••••";
    return `••••${value.slice(-6)}`;
  }

  private buildWebhookUrl(connectionId: string) {
    const base = process.env.PUBLIC_API_URL ?? "http://localhost:3001";
    return `${base.replace(/\/$/, "")}/api/integrations/webhooks/${connectionId}`;
  }

  private generateWebhookSecret() {
    return `whsec_${randomBytes(24).toString("hex")}`;
  }

  /** For tests: deterministic secret fingerprint without exposing full value */
  fingerprintSecret(secret: string) {
    return createHash("sha256").update(secret).digest("hex").slice(0, 12);
  }
}
