import { defineConfig, devices, type TraceMode } from "@playwright/test";

type ScreenshotMode = "off" | "on" | "only-on-failure";

function traceFromEnv(): TraceMode {
  const v = process.env.PLAYWRIGHT_TRACE;
  if (v === "on" || v === "off" || v === "on-first-retry" || v === "retain-on-failure") {
    return v;
  }
  return "on-first-retry";
}

function screenshotFromEnv(): ScreenshotMode {
  const v = process.env.PLAYWRIGHT_SCREENSHOT;
  if (v === "off" || v === "on" || v === "only-on-failure") return v;
  return "only-on-failure";
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: traceFromEnv(),
    screenshot: screenshotFromEnv(),
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /visual-guide.*\.spec\.ts|smoke-local.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "smoke-local",
      testMatch: /smoke-local-\d+.*\.spec\.ts/,
      timeout: 120_000,
      expect: { timeout: 5_000 },
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        headless: process.env.SMOKE_HEADLESS === "1",
        actionTimeout: 5_000,
        navigationTimeout: 15_000,
      },
      ...(process.env.CI
        ? {}
        : {
            webServer: [
              {
                command: "pnpm --filter @erp/api dev",
                cwd: "../../",
                url: "http://localhost:3001/api/health",
                reuseExistingServer: true,
                timeout: 180_000,
              },
              {
                command: "pnpm --filter @erp/web dev",
                cwd: "../../",
                url: "http://localhost:3000",
                reuseExistingServer: true,
                timeout: 180_000,
              },
            ],
          }),
    },
    {
      name: "visual-guide",
      testMatch: /visual-guide.*\.spec\.ts/,
      timeout: 180_000,
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1440, height: 900 },
        trace: "on",
        screenshot: "off",
      },
    },
  ],
  // E2E mocks API on :3001 — only Next.js is required locally.
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm --filter @erp/web dev",
        cwd: "../../",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
