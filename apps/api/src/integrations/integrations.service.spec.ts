import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ReservationStatus } from "@erp/types";
import { IntegrationsService } from "./integrations.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { PmsService } from "../pms/pms.service";
import { TenantScopeService } from "../common/tenant/tenant-scope.service";
import { IntegrationConnectionStatus } from "./integration-connection.constants";

const mockPrisma = {
  integrationConnection: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  integrationWebhookEvent: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  branch: { findFirst: jest.fn() },
  room: { findFirst: jest.fn() },
  guest: { findFirst: jest.fn() },
};

const mockAudit = { record: jest.fn() };
const mockPms = {
  createGuest: jest.fn(),
  createReservation: jest.fn(),
};

const mockTenantScope = {
  assertBranchInOrganization: jest.fn().mockResolvedValue(undefined),
};

describe("IntegrationsService", () => {
  let service: IntegrationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTenantScope.assertBranchInOrganization.mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: PmsService, useValue: mockPms },
        { provide: TenantScopeService, useValue: mockTenantScope },
      ],
    }).compile();
    service = module.get(IntegrationsService);
  });

  describe("listAdapters", () => {
    it("returns adapter registry", () => {
      const adapters = service.listAdapters();
      expect(adapters.some((a) => a.key === "generic_webhook")).toBe(true);
      expect(adapters.some((a) => a.key === "ota_inquiry")).toBe(true);
    });
  });

  describe("createConnection", () => {
    it("rejects unknown adapter", async () => {
      await expect(
        service.createConnection("org-1", "user-1", {
          adapterKey: "unknown",
          name: "Test",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects branchId outside organization", async () => {
      mockTenantScope.assertBranchInOrganization.mockRejectedValue(
        new ForbiddenException("Branch does not belong to this organization"),
      );
      await expect(
        service.createConnection("org-1", "user-1", {
          adapterKey: "generic_webhook",
          name: "Hook",
          branchId: "branch-other",
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.integrationConnection.create).not.toHaveBeenCalled();
    });

    it("creates connection and returns webhook secret once", async () => {
      mockPrisma.integrationConnection.create.mockResolvedValue({
        id: "int-1",
        organizationId: "org-1",
        branchId: null,
        adapterKey: "generic_webhook",
        name: "Hook",
        status: IntegrationConnectionStatus.ACTIVE,
        webhookSecret: "whsec_abc123",
        credentialsJson: null,
        configJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        branch: null,
      });

      const result = await service.createConnection("org-1", "user-1", {
        adapterKey: "generic_webhook",
        name: "Hook",
      });

      expect(result.webhookSecret).toMatch(/^whsec_/);
      expect(result.webhookUrl).toContain("/api/integrations/webhooks/int-1");
      expect(mockAudit.record).toHaveBeenCalled();
    });
  });

  describe("handleWebhook", () => {
    const connection = {
      id: "int-1",
      organizationId: "org-1",
      branchId: "branch-1",
      adapterKey: "generic_webhook",
      status: IntegrationConnectionStatus.ACTIVE,
      webhookSecret: "whsec_test",
      branch: { id: "branch-1" },
    };

    beforeEach(() => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue(connection);
      mockPrisma.integrationWebhookEvent.create.mockResolvedValue({ id: "iwe-1" });
      mockPrisma.integrationWebhookEvent.update.mockResolvedValue({});
    });

    it("rejects invalid secret", async () => {
      await expect(
        service.handleWebhook("int-1", "wrong", { event: "ping" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("processes generic webhook without side effects", async () => {
      const result = await service.handleWebhook("int-1", "whsec_test", {
        event: "ping",
        data: { ok: true },
      });
      expect(result.ok).toBe(true);
      expect(mockPms.createReservation).not.toHaveBeenCalled();
    });

    it("imports OTA inquiry on booking.import", async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        ...connection,
        adapterKey: "ota_inquiry",
      });
      mockPrisma.room.findFirst.mockResolvedValue({ id: "room-1", branchId: "branch-1" });
      mockPrisma.guest.findFirst.mockResolvedValue(null);
      mockPms.createGuest.mockResolvedValue({ id: "guest-1" });
      mockPms.createReservation.mockResolvedValue({ id: "res-1" });

      await service.handleWebhook("int-1", "whsec_test", {
        event: "booking.import",
        roomId: "room-1",
        checkIn: "2026-07-01",
        checkOut: "2026-07-03",
        guest: { email: "ota@example.com", fullName: "OTA Guest" },
      });

      expect(mockPms.createReservation).toHaveBeenCalledWith(
        "branch-1",
        expect.objectContaining({
          guestId: "guest-1",
          roomId: "room-1",
          status: ReservationStatus.INQUIRY,
        }),
        undefined,
      );
    });

    it("throws when connection not found", async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue(null);
      await expect(
        service.handleWebhook("missing", "whsec_test", {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
