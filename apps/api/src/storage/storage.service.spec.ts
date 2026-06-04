import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { StorageService } from "./storage.service";

const mockPutObject = jest.fn();
const mockGetObject = jest.fn();
const mockBucketExists = jest.fn();

jest.mock("minio", () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: mockBucketExists,
    makeBucket: jest.fn(),
    putObject: mockPutObject,
    getObject: mockGetObject,
  })),
}));

describe("StorageService", () => {
  let service: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockBucketExists.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              const map: Record<string, unknown> = {
                MINIO_BUCKET: "erp-files",
                MINIO_ENDPOINT: "localhost",
                MINIO_PORT: 9000,
                MINIO_USE_SSL: "false",
                MINIO_ACCESS_KEY: "minioadmin",
                MINIO_SECRET_KEY: "minioadmin",
              };
              return map[key] ?? fallback;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(StorageService);
    await service.onModuleInit();
  });

  it("upload stores object and returns key url", async () => {
    mockPutObject.mockResolvedValue(undefined);
    const body = Buffer.from("pdf");

    const result = await service.upload("payroll/pr-1.pdf", body, "application/pdf");

    expect(mockPutObject).toHaveBeenCalledWith(
      "erp-files",
      "payroll/pr-1.pdf",
      body,
      body.length,
      { "Content-Type": "application/pdf" },
    );
    expect(result).toEqual({ key: "payroll/pr-1.pdf", url: "erp-files/payroll/pr-1.pdf" });
  });

  it("download concatenates stream chunks", async () => {
    const chunks = [Buffer.from("%PDF-1.4"), Buffer.from("\npage")];
    mockGetObject.mockResolvedValue({
      on(event: string, handler: (arg?: Buffer) => void) {
        if (event === "data") chunks.forEach((c) => handler(c));
        if (event === "end") handler();
      },
    });

    const buf = await service.download("payroll/pr-1.pdf");

    expect(buf?.toString()).toBe("%PDF-1.4\npage");
  });

  it("returns null from download when MinIO init failed", async () => {
    mockBucketExists.mockRejectedValueOnce(new Error("connection refused"));
    const disabled = new StorageService({
      get: jest.fn(() => undefined),
    } as never);
    await disabled.onModuleInit();

    await expect(disabled.download("missing.pdf")).resolves.toBeNull();
    await expect(
      disabled.upload("x.pdf", Buffer.from("x"), "application/pdf"),
    ).resolves.toEqual({ key: "x.pdf", url: null });
  });
});
