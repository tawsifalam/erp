import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PosService } from "./pos.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";

jest.mock("@erp/utils", () => ({
  toNumber: (v: unknown) => Number(v),
}));

const mockPrisma = {
  menuCategory: { findMany: jest.fn(), create: jest.fn() },
  menuItem: { create: jest.fn() },
  order: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  kitchenTicket: { create: jest.fn() },
  $transaction: jest.fn(),
};

const mockEvents = {
  emit: jest.fn(),
};

const mockRealtime = {
  emitKitchenTicket: jest.fn(),
  emitOrderUpdate: jest.fn(),
  emitRoomStatus: jest.fn(),
};

describe("PosService", () => {
  let service: PosService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEvents },
        { provide: RealtimeGateway, useValue: mockRealtime },
      ],
    }).compile();

    service = module.get<PosService>(PosService);
  });

  describe("createOrder", () => {
    it("calculates totalAmount from lines", async () => {
      mockPrisma.order.create.mockResolvedValue({
        id: "order-1",
        totalAmount: 350,
        lines: [],
      });

      await service.createOrder("branch-1", "org-1", {
        lines: [
          { menuItemId: "mi-1", quantity: 2, unitPrice: 100 },
          { menuItemId: "mi-2", quantity: 3, unitPrice: 50 },
        ],
        tableNumber: "T5",
      });

      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          totalAmount: 350, // 2*100 + 3*50
          status: OrderStatus.DRAFT,
        }),
        include: { lines: { include: { menuItem: true } } },
      });
    });

    it("creates order lines with lineTotal", async () => {
      mockPrisma.order.create.mockResolvedValue({ id: "order-1" });

      await service.createOrder("branch-1", "org-1", {
        lines: [{ menuItemId: "mi-1", quantity: 4, unitPrice: 25 }],
      });

      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          lines: {
            create: [
              {
                menuItemId: "mi-1",
                quantity: 4,
                unitPrice: 25,
                lineTotal: 100,
              },
            ],
          },
        }),
        include: expect.any(Object),
      });
    });

    it("sets status to DRAFT", async () => {
      mockPrisma.order.create.mockResolvedValue({ id: "order-1" });

      await service.createOrder("branch-1", "org-1", {
        lines: [{ menuItemId: "mi-1", quantity: 1, unitPrice: 10 }],
      });

      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: OrderStatus.DRAFT }),
        include: expect.any(Object),
      });
    });

    it("passes tableNumber and notes", async () => {
      mockPrisma.order.create.mockResolvedValue({ id: "order-1" });

      await service.createOrder("branch-1", "org-1", {
        lines: [{ menuItemId: "mi-1", quantity: 1, unitPrice: 10 }],
        tableNumber: "T1",
        notes: "No spice",
      });

      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tableNumber: "T1",
          notes: "No spice",
        }),
        include: expect.any(Object),
      });
    });
  });

  describe("submitOrder", () => {
    it("throws NotFoundException when order not found", async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.submitOrder("order-1", "branch-1", "org-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("creates kitchen ticket and emits realtime events", async () => {
      const order = { id: "order-1", lines: [] };
      mockPrisma.order.findFirst.mockResolvedValue(order);

      const updatedOrder = { id: "order-1", status: OrderStatus.SUBMITTED };
      const ticket = { id: "kt-1", orderId: "order-1" };
      mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
        fn({
          order: {
            update: jest.fn().mockResolvedValue(updatedOrder),
          },
          kitchenTicket: {
            create: jest.fn().mockResolvedValue(ticket),
          },
        }),
      );

      const result = await service.submitOrder("order-1", "branch-1", "org-1");

      expect(result).toEqual({ order: updatedOrder, ticket });
      expect(mockRealtime.emitKitchenTicket).toHaveBeenCalledWith(
        "branch-1",
        ticket,
      );
      expect(mockRealtime.emitOrderUpdate).toHaveBeenCalledWith(
        "branch-1",
        updatedOrder,
      );
    });
  });

  describe("completeOrder", () => {
    it("throws NotFoundException when order not found", async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.completeOrder("order-1", "branch-1", "org-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("sets PAID when paidAmount >= total", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: "order-1",
        totalAmount: 100,
      });
      const updatedOrder = {
        id: "order-1",
        status: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
      };
      mockPrisma.order.update.mockResolvedValue(updatedOrder);

      const result = await service.completeOrder(
        "order-1",
        "branch-1",
        "org-1",
        150,
      );

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: {
          status: OrderStatus.COMPLETED,
          paymentStatus: PaymentStatus.PAID,
          paidAmount: 150,
        },
        include: { lines: { include: { menuItem: true } } },
      });
      expect(result).toEqual(updatedOrder);
    });

    it("sets PARTIAL when 0 < paidAmount < total", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: "order-1",
        totalAmount: 100,
      });
      mockPrisma.order.update.mockResolvedValue({ id: "order-1" });

      await service.completeOrder("order-1", "branch-1", "org-1", 50);

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: expect.objectContaining({
          paymentStatus: PaymentStatus.PARTIAL,
          paidAmount: 50,
        }),
        include: expect.any(Object),
      });
    });

    it("sets UNPAID when paidAmount is 0", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: "order-1",
        totalAmount: 100,
      });
      mockPrisma.order.update.mockResolvedValue({ id: "order-1" });

      await service.completeOrder("order-1", "branch-1", "org-1", 0);

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: expect.objectContaining({
          paymentStatus: PaymentStatus.UNPAID,
          paidAmount: 0,
        }),
        include: expect.any(Object),
      });
    });

    it("defaults paidAmount to total when not provided", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: "order-1",
        totalAmount: 200,
      });
      mockPrisma.order.update.mockResolvedValue({ id: "order-1" });

      await service.completeOrder("order-1", "branch-1", "org-1");

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: expect.objectContaining({
          paymentStatus: PaymentStatus.PAID,
          paidAmount: 200,
        }),
        include: expect.any(Object),
      });
    });

    it("emits order.completed event", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: "order-1",
        totalAmount: 100,
      });
      mockPrisma.order.update.mockResolvedValue({ id: "order-1" });

      await service.completeOrder("order-1", "branch-1", "org-1", 100);

      expect(mockEvents.emit).toHaveBeenCalledWith(
        "order.completed",
        expect.objectContaining({
          orderId: "order-1",
          branchId: "branch-1",
          organizationId: "org-1",
          totalAmount: 100,
        }),
      );
    });

    it("emits order update via realtime gateway", async () => {
      const updatedOrder = { id: "order-1", status: OrderStatus.COMPLETED };
      mockPrisma.order.findFirst.mockResolvedValue({
        id: "order-1",
        totalAmount: 100,
      });
      mockPrisma.order.update.mockResolvedValue(updatedOrder);

      await service.completeOrder("order-1", "branch-1", "org-1", 100);

      expect(mockRealtime.emitOrderUpdate).toHaveBeenCalledWith(
        "branch-1",
        updatedOrder,
      );
    });
  });

  describe("updateOrderStatus", () => {
    it("updates status and emits realtime event", async () => {
      const updated = { id: "order-1", status: OrderStatus.PREPARING };
      mockPrisma.order.update.mockResolvedValue(updated);

      const result = await service.updateOrderStatus(
        "order-1",
        "branch-1",
        OrderStatus.PREPARING,
      );

      expect(result).toEqual(updated);
      expect(mockRealtime.emitOrderUpdate).toHaveBeenCalledWith(
        "branch-1",
        updated,
      );
    });
  });

  describe("listCategories", () => {
    it("queries categories with items ordered by sortOrder", async () => {
      mockPrisma.menuCategory.findMany.mockResolvedValue([]);
      await service.listCategories("branch-1");
      expect(mockPrisma.menuCategory.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        include: { items: true },
        orderBy: { sortOrder: "asc" },
      });
    });
  });
});
