/** Seeded tenant IDs from apps/api/prisma/seed.ts — used by local smoke tests. */
export const SMOKE_SEED_ORG_ID =
  process.env.SMOKE_ORG_ID ?? "org_00000000-0000-0000-0000-000000000100";
export const SMOKE_SEED_BRANCH_ID =
  process.env.SMOKE_BRANCH_ID ?? "br_00000000-0000-0000-0000-000000000001";
/** Second seed branch (Boulevard Café) — used for branch-grant denial smoke. */
export const SMOKE_SEED_BRANCH_ID_2 =
  process.env.SMOKE_BRANCH_ID_2 ?? "br_00000000-0000-0000-0000-000000000002";
