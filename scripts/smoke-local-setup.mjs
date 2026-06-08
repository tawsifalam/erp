#!/usr/bin/env node
/**
 * Prepare local smoke tests: JWT login + seed org membership.
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
const REFRESH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "erp_refresh";

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

const email = process.env.SMOKE_USER_EMAIL ?? "admin@boulevard.cafe";
const password = process.env.SMOKE_USER_PASSWORD ?? "DemoPassword1!";
const frontDeskEmail = process.env.SMOKE_FRONT_DESK_USER_EMAIL;
const frontDeskPassword = process.env.SMOKE_FRONT_DESK_USER_PASSWORD;
/** Login hits Nest directly — not the Next.js proxy (web may not be up yet). */
const apiBase = (
  process.env.SMOKE_API_URL ??
  process.env.API_URL ??
  "http://localhost:3001"
).replace(/\/$/, "");

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing ${name}. See docs/smoke-local.md`);
    process.exit(1);
  }
}

function parseRefreshCookie(setCookieHeaders) {
  for (const header of setCookieHeaders) {
    const [pair] = header.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    if (name === REFRESH_COOKIE_NAME) {
      return pair.slice(eq + 1).trim();
    }
  }
  return null;
}

async function login(userEmail, userPassword) {
  let res;
  try {
    res = await fetch(`${apiBase}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail, password: userPassword }),
    });
  } catch (err) {
    const hint =
      err?.cause?.code === "ECONNREFUSED" || err?.message === "fetch failed"
        ? ` Is the API running at ${apiBase}? Try: pnpm dev — or pnpm smoke:local (starts servers automatically).`
        : "";
    throw new Error(`POST /api/auth/login failed: ${err?.message ?? err}.${hint}`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST /api/auth/login failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const setCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie")]
        : [];
  const refreshToken = parseRefreshCookie(setCookies);
  if (!data.accessToken || !data.user?.id) {
    throw new Error("Login response missing accessToken or user");
  }
  if (!refreshToken) {
    throw new Error(`Login response missing ${REFRESH_COOKIE_NAME} cookie`);
  }
  return {
    accessToken: data.accessToken,
    userId: data.user.id,
    email: data.user.email,
    refreshToken,
  };
}

async function ensureMembership(userId) {
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
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(`No ERP user ${userId}. Is the API running? Run pnpm db:reset.`);
    }

    const org = await prisma.organization.findUnique({
      where: { id: SMOKE_SEED_ORG_ID },
    });
    if (!org) {
      throw new Error(`Seed org ${SMOKE_SEED_ORG_ID} not found. Run: pnpm db:reset`);
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

async function ensureFrontDeskBranchGrant(ownerUserId, frontDeskLogin) {
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
    const owner = await prisma.user.findUnique({ where: { id: ownerUserId } });
    const frontDesk = await prisma.user.findUnique({ where: { id: frontDeskLogin.userId } });
    if (!frontDesk) {
      throw new Error(`No ERP user for front-desk login ${frontDeskLogin.email}.`);
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

    return {
      accessToken: frontDeskLogin.accessToken,
      refreshToken: frontDeskLogin.refreshToken,
      userId: frontDesk.id,
      grantedBranchId: SMOKE_SEED_BRANCH_ID,
      deniedBranchId: SMOKE_SEED_BRANCH_ID_2,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  requireEnv("SMOKE_USER_EMAIL (or default admin@boulevard.cafe)", email);
  requireEnv("SMOKE_USER_PASSWORD (or default DemoPassword1!)", password);

  console.log(`Logging in as ${email}…`);
  const session = await login(email, password);

  console.log("Ensuring membership in seed organization…");
  await ensureMembership(session.userId);

  let frontDeskAuth = null;
  if (frontDeskEmail && frontDeskPassword) {
    console.log("Preparing front-desk branch-grant smoke user…");
    const frontDeskLogin = await login(frontDeskEmail, frontDeskPassword);
    frontDeskAuth = await ensureFrontDeskBranchGrant(session.userId, frontDeskLogin);
  }

  await mkdir(path.dirname(AUTH_FILE), { recursive: true });
  const payload = {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    userId: session.userId,
    email: session.email,
    organizationId: SMOKE_SEED_ORG_ID,
    branchId: SMOKE_SEED_BRANCH_ID,
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
