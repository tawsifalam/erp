import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PosService } from "./pos.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";

jest.mock("@erp/utils", () => ({
  toNumber: (v: unknown) => Number(v),
  generatePrefixedId: (prefix: string) => `${prefix}_test`,
}));

const mockPrisma = {
  menuCategory: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  menuItem: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  orderLine: { count: jest.fn() },
  order: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  kitchenTicket: { create: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockEvents = { emit: jest.fn() };
const mockRealtime = {
  emitKitchenTicket: jest.fn(),
  emitOrderUpdate: jest.fn(),
  emitRoomStatus: jest.fn(),
};

const draftOrder = {
  id: "order-1",
  branchId: "branch-1",
  status: OrderStatus.DRAFT,
  totalAmount: 100,
  paidAmount: 0,
  lines: [{ id: "ol-1", menuItemId: "mi-1", quantity: 1 }],
  kitchenTickets: [],
  guest: undefined,
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
    service = module.get(PosService);
  });

  describe("createOrder", () => {
    it("throws when lines are empty", async () => {
      await expect(
        service.createOrder("branch-1", "org-1", { lines: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it("calculates totalAmount from lines", async () => {
      mockPrisma.order.create.mockResolvedValue({ id: "order-1", totalAmount: 350 });

      await service.createOrder("branch-1", "org-1", {
        lines: [
          { menuItemId: "mi-1", quantity: 2, unitPrice: 100 },
          { menuItemId: "mi-2", quantity: 3, unitPrice: 50 },
        ],
        tableNumber: "T5",
      });

      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totalAmount: 350, status: OrderStatus.DRAFT }),
        }),
      );
    });
  });

  describe("submitOrder", () => {
    it("throws when order is not DRAFT", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...draftOrder,
        status: OrderStatus.SUBMITTED,
      });

      await expect(service.submitOrder("order-1", "branch-1", "org-1")).rejects.toThrow(
        "Only DRAFT orders can be submitted",
      );
    });

    it("creates kitchen ticket and emits realtime events", async () => {
      mockPrisma.order.findFirst.mockResolvedValue(draftOrder);
      const updatedOrder = { ...draftOrder, status: OrderStatus.SUBMITTED };
      const ticket = { id: "kt-1", orderId: "order-1" };
      mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
        fn({
          order: { update: jest.fn().mockResolvedValue(updatedOrder) },
          kitchenTicket: { create: jest.fn().mockResolvedValue(ticket) },
        }),
      );

      const result = await service.submitOrder("order-1", "branch-1", "org-1");

      expect(result).toEqual({ order: updatedOrder, ticket });
      expect(mockRealtime.emitKitchenTicket).toHaveBeenCalledWith("branch-1", ticket);
    });
  });

  describe("completeOrder", () => {
    it("throws when order is not completable", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...draftOrder,
        status: OrderStatus.DRAFT,
      });

      await expect(
        service.completeOrder("order-1", "branch-1", "org-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("sets PAID when paidAmount >= total", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...draftOrder,
        status: OrderStatus.SUBMITTED,
        totalAmount: 100,
      });
      const updatedOrder = {
        id: "order-1",
        status: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
      };
      mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
        fn({
          order: { update: jest.fn().mockResolvedValue(updatedOrder) },
          kitchenTicket: { updateMany: jest.fn().mockResolvedValue({}) },
        }),
      );

      await service.completeOrder("order-1", "branch-1", "org-1", 100);

      expect(mockEvents.emit).toHaveBeenCalledWith(
        "order.completed",
        expect.objectContaining({ orderId: "order-1", totalAmount: 100, paidAmount: 100 }),
      );
    });

    it("sets PARTIAL when 0 < paidAmount < total", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...draftOrder,
        status: OrderStatus.READY,
        totalAmount: 100,
      });
      mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
        fn({
          order: {
            update: jest.fn().mockResolvedValue({
              paymentStatus: PaymentStatus.PARTIAL,
            }),
          },
          kitchenTicket: { updateMany: jest.fn() },
        }),
      );

      await service.completeOrder("order-1", "branch-1", "org-1", 50);

      expect(mockEvents.emit).toHaveBeenCalledWith(
        "order.completed",
        expect.objectContaining({ totalAmount: 100, paidAmount: 50 }),
      );
    });
  });

  describe("cancelOrder", () => {
    it("throws when order is COMPLETED", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...draftOrder,
        status: OrderStatus.COMPLETED,
      });

      await expect(service.cancelOrder("order-1", "branch-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("cancels SUBMITTED order", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...draftOrder,
        status: OrderStatus.SUBMITTED,
      });
      const cancelled = { ...draftOrder, status: OrderStatus.CANCELLED };
      mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
        fn({
          order: { update: jest.fn().mockResolvedValue(cancelled) },
          kitchenTicket: { updateMany: jest.fn() },
        }),
      );

      const result = await service.cancelOrder("order-1", "branch-1");
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe("updateOrderStatus", () => {
    it("throws invalid kitchen transition", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...draftOrder,
        status: OrderStatus.DRAFT,
      });

      await expect(
        service.updateOrderStatus("order-1", "branch-1", OrderStatus.PREPARING),
      ).rejects.toThrow(BadRequestException);
    });

    it("allows SUBMITTED to PREPARING", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...draftOrder,
        status: OrderStatus.SUBMITTED,
      });
      const updated = { id: "order-1", status: OrderStatus.PREPARING };
      mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
        fn({
          order: { update: jest.fn().mockResolvedValue(updated) },
          kitchenTicket: { updateMany: jest.fn() },
        }),
      );

      const result = await service.updateOrderStatus(
        "order-1",
        "branch-1",
        OrderStatus.PREPARING,
      );
      expect(result.status).toBe(OrderStatus.PREPARING);
    });

    it("allows PREPARING to READY", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...draftOrder,
        status: OrderStatus.PREPARING,
      });
      const updated = { id: "order-1", status: OrderStatus.READY };
      mockPrisma.$transaction.mockImplementation(async (fn: Function) =>
        fn({
          order: { update: jest.fn().mockResolvedValue(updated) },
          kitchenTicket: { updateMany: jest.fn() },
        }),
      );

      const result = await service.updateOrderStatus(
        "order-1",
        "branch-1",
        OrderStatus.READY,
      );
      expect(result.status).toBe(OrderStatus.READY);
    });
  });

  describe("deleteCategory", () => {
    it("throws when category has items", async () => {
      mockPrisma.menuCategory.findFirst.mockResolvedValue({ id: "mc-1" });
      mockPrisma.menuItem.count.mockResolvedValue(2);

      await expect(service.deleteCategory("branch-1", "mc-1")).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("deleteMenuItem", () => {
    it("throws when item on orders", async () => {
      mockPrisma.menuItem.findUnique.mockResolvedValue({ id: "mi-1" });
      mockPrisma.orderLine.count.mockResolvedValue(1);

      await expect(service.deleteMenuItem("mi-1")).rejects.toThrow(ConflictException);
    });
  });

  describe("getOrder", () => {
    it("throws NotFoundException when missing", async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      await expect(service.getOrder("branch-1", "x")).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteOrder", () => {
    it("throws when order is completed", async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...draftOrder,
        status: OrderStatus.COMPLETED,
      });

      await expect(service.deleteOrder("order-1", "branch-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("deletes draft order and tickets", async () => {
      mockPrisma.order.findFirst.mockResolvedValue(draftOrder);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.deleteOrder("order-1", "branch-1");

      expect(result).toEqual({ id: "order-1" });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
