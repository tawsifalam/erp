import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "./email.service";

describe("EmailService", () => {
  let service: EmailService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => {
              if (key === "RESEND_API_KEY") return undefined;
              if (key === "EMAIL_FROM") return fallback;
              return undefined;
            }),
          },
        },
      ],
    }).compile();
    service = module.get(EmailService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("logs instead of calling Resend when API key is missing", async () => {
    const logSpy = jest.spyOn(service["logger"], "log");
    global.fetch = jest.fn();

    await service.send({
      to: "staff@example.com",
      subject: "Payroll complete",
      body: "Run finished",
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("staff@example.com"),
    );
    logSpy.mockRestore();
  });

  it("posts to Resend when API key is configured", async () => {
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === "RESEND_API_KEY") return "re_test_key";
        if (key === "EMAIL_FROM") return "ERP <test@resend.dev>";
        return fallback;
      }),
    };
    service = new EmailService(config as never);

    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    await service.send({
      to: "staff@example.com",
      subject: "Low stock",
      body: "Cooking oil is low",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key",
        }),
      }),
    );
  });

  it("throws when Resend returns an error status", async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === "RESEND_API_KEY") return "re_test_key";
        if (key === "EMAIL_FROM") return "ERP <test@resend.dev>";
        return undefined;
      }),
    };
    service = new EmailService(config as never);

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "invalid recipient",
    });

    await expect(
      service.send({ to: "bad", subject: "x", body: "y" }),
    ).rejects.toThrow(/Failed to send email/);
  });
});
