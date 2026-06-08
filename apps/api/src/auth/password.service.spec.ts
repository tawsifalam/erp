import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("hashes and verifies passwords", async () => {
    const hash = await service.hash("TestPassword1!");
    expect(hash).not.toBe("TestPassword1!");
    expect(await service.verify("TestPassword1!", hash)).toBe(true);
    expect(await service.verify("wrong", hash)).toBe(false);
  });
});
