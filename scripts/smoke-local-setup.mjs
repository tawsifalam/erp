#!/usr/bin/env node
/**
 * Prepare local smoke tests: PropelAuth access token + ERP user sync + seed org membership.
 * See docs/smoke-local.md
 */
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  SMOKE_SEED_BRANCH_ID,
  SMOKE_SEED_BRANCH_ID_2,
  SMOKE_SEED_ORG_ID,
} from "./smoke-seed-constants.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const AUTH_FILE = path.join(ROOT, ".playwright", "smoke-auth.json");

function loadEnvFile(filePath) {
  try {
    const text = readFileSync(filePath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

loadEnvFile(path.join(ROOT, ".env"));
loadEnvFile(path.join(ROOT, "apps/web/.env.local"));

const authUrl = process.env.PROPELAUTH_AUTH_URL?.replace(/\/$/, "");
const apiKey = process.env.PROPELAUTH_API_KEY;
const userId = process.env.SMOKE_PROPELAUTH_USER_ID;
const frontDeskUserId = process.env.SMOKE_PROPELAUTH_FRONT_DESK_USER_ID;
const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing ${name}. See docs/smoke-local.md`);
    process.exit(1);
  }
}

async function createAccessToken(propelAuthUserId) {
  const res = await fetch(`${authUrl}/api/backend/v1/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      user_id: propelAuthUserId,
      duration_in_minutes: 60 * 24,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PropelAuth access_token failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const token = data.access_token ?? data.accessToken;
  if (!token) throw new Error("PropelAuth response missing access_token");
  return token;
}

async function syncUser(accessToken) {
  const res = await fetch(`${apiBase}/api/auth/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Organization-Id": SMOKE_SEED_ORG_ID,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST /api/auth/sync failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function ensureMembership() {
  const require = createRequire(path.join(ROOT, "apps/api/package.json"));
  const { PrismaClient } = require("@prisma/client");
  let Role;
  try {
    ({ Role } = require("@erp/types"));
  } catch {
    Role = { OWNER: "OWNER" };
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { propelAuthUserId: userId },
    });
    if (!user) {
      throw new Error(
        `No ERP user for PropelAuth id ${userId}. Is the API running? Re-run after sync.`,
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: SMOKE_SEED_ORG_ID },
    });
    if (!org) {
      throw new Error(
        `Seed org ${SMOKE_SEED_ORG_ID} not found. Run: pnpm db:reset`,
      );
    }

    const existing = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: { userId: user.id, organizationId: SMOKE_SEED_ORG_ID },
      },
    });
    if (!existing) {
      await prisma.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: SMOKE_SEED_ORG_ID,
          role: Role.OWNER,
        },
      });
      console.log(`Linked user to seed org as OWNER (${org.name})`);
    } else {
      console.log(`User already member of ${org.name} (${existing.role})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function ensureFrontDeskBranchGrant(ownerPropelAuthUserId) {
  if (!frontDeskUserId) return null;

  const require = createRequire(path.join(ROOT, "apps/api/package.json"));
  const { PrismaClient } = require("@prisma/client");
  let Role;
  try {
    ({ Role } = require("@erp/types"));
  } catch {
    Role = { OWNER: "OWNER", FRONT_DESK: "FRONT_DESK" };
  }

  const prisma = new PrismaClient();
  try {
    const owner = await prisma.user.findUnique({
      where: { propelAuthUserId: ownerPropelAuthUserId },
    });
    const frontDesk = await prisma.user.findUnique({
      where: { propelAuthUserId: frontDeskUserId },
    });
    if (!frontDesk) {
      throw new Error(
        `No ERP user for front-desk PropelAuth id ${frontDeskUserId}. Re-run setup after API sync.`,
      );
    }

    await prisma.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId: frontDesk.id,
          organizationId: SMOKE_SEED_ORG_ID,
        },
      },
      create: {
        userId: frontDesk.id,
        organizationId: SMOKE_SEED_ORG_ID,
        role: Role.FRONT_DESK,
      },
      update: { role: Role.FRONT_DESK },
    });

    await prisma.userBranch.upsert({
      where: {
        userId_branchId: {
          userId: frontDesk.id,
          branchId: SMOKE_SEED_BRANCH_ID,
        },
      },
      create: {
        organizationId: SMOKE_SEED_ORG_ID,
        userId: frontDesk.id,
        branchId: SMOKE_SEED_BRANCH_ID,
        status: "ACTIVE",
        grantedByUserId: owner?.id ?? frontDesk.id,
      },
      update: {
        organizationId: SMOKE_SEED_ORG_ID,
        status: "ACTIVE",
        grantedByUserId: owner?.id ?? frontDesk.id,
      },
    });

    await prisma.userBranch.deleteMany({
      where: {
        userId: frontDesk.id,
        branchId: SMOKE_SEED_BRANCH_ID_2,
      },
    });

    console.log(
      `Front-desk smoke user: FRONT_DESK on ${SMOKE_SEED_BRANCH_ID} only (no grant on ${SMOKE_SEED_BRANCH_ID_2})`,
    );

    const accessToken = await createAccessToken(frontDeskUserId);
    return {
      accessToken,
      propelAuthUserId: frontDeskUserId,
      grantedBranchId: SMOKE_SEED_BRANCH_ID,
      deniedBranchId: SMOKE_SEED_BRANCH_ID_2,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  requireEnv("PROPELAUTH_AUTH_URL", authUrl);
  requireEnv("PROPELAUTH_API_KEY", apiKey);
  requireEnv("SMOKE_PROPELAUTH_USER_ID", userId);

  console.log("Creating PropelAuth access token…");
  const accessToken = await createAccessToken(userId);

  console.log("Syncing ERP user (API must be running)…");
  await syncUser(accessToken);

  console.log("Ensuring membership in seed organization…");
  await ensureMembership();

  let frontDeskAuth = null;
  if (frontDeskUserId) {
    console.log("Preparing front-desk branch-grant smoke user…");
    const frontDeskToken = await createAccessToken(frontDeskUserId);
    await syncUser(frontDeskToken);
    frontDeskAuth = await ensureFrontDeskBranchGrant(userId);
  }

  await mkdir(path.dirname(AUTH_FILE), { recursive: true });
  const payload = {
    accessToken,
    organizationId: SMOKE_SEED_ORG_ID,
    branchId: SMOKE_SEED_BRANCH_ID,
    propelAuthUserId: userId,
    ...(frontDeskAuth ? { frontDeskAuth } : {}),
    createdAt: new Date().toISOString(),
  };
  await writeFile(AUTH_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${path.relative(ROOT, AUTH_FILE)}`);
  console.log("Run: pnpm smoke:local");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
