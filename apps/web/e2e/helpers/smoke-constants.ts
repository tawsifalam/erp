/** Seeded tenant IDs from apps/api/prisma/seed.ts */
export const SMOKE_SEED_ORG_ID =
  process.env.SMOKE_ORG_ID ?? "org_00000000-0000-0000-0000-000000000100";
export const SMOKE_SEED_BRANCH_ID =
  process.env.SMOKE_BRANCH_ID ?? "br_00000000-0000-0000-0000-000000000001";

/** Seed display names — must match apps/api/prisma/seed.ts */
export const SMOKE_SEED_ORG_NAME = "Boulevard Hospitality Group";
export const SMOKE_SEED_BRANCH_NAME = "Main Hotel & Restaurant";

export const SMOKE_AUTH_FILE = ".playwright/smoke-auth.json";

/** Default Playwright expect / action timeout for smoke-local (ms). */
export const SMOKE_TIMEOUT = 5_000;
