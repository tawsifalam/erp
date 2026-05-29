import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { InventoryPoolsService } from "./inventory-pools.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  inventoryPool: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
};

describe("InventoryPoolsService", () => {
  let service: InventoryPoolsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryPoolsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(InventoryPoolsService);
  });

  it("rejects invalid pool codes", async () => {
    await expect(
      service.createPool("org-1", { code: "Bad Code!", name: "Test" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects reserved system codes", async () => {
    await expect(
      service.createPool("org-1", { code: "guest", name: "Duplicate" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("seeds default guest and staff pools", async () => {
    mockPrisma.inventoryPool.upsert.mockResolvedValue({});

    await service.seedDefaultPools("org-1");

    expect(mockPrisma.inventoryPool.upsert).toHaveBeenCalledTimes(2);
  });
});
