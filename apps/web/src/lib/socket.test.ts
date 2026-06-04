import { describe, expect, it, vi, beforeEach } from "vitest";

const emit = vi.fn();
const io = vi.fn(() => ({ emit }));

vi.mock("socket.io-client", () => ({ io }));

describe("socket helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {} as Window & typeof globalThis);
    vi.resetModules();
    emit.mockClear();
    io.mockClear();
  });

  it("joinKitchen emits kitchen room channel", async () => {
    const { joinKitchen } = await import("./socket");
    joinKitchen("branch-test-001");
    expect(emit).toHaveBeenCalledWith("join", "kitchen:branch-test-001");
  });

  it("joinBranch emits branch channel", async () => {
    const { joinBranch } = await import("./socket");
    joinBranch("branch-test-002");
    expect(emit).toHaveBeenCalledWith("join", "branch:branch-test-002");
  });
});
