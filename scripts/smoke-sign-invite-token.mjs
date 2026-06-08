#!/usr/bin/env node
/**
 * Sign an invite JWT for smoke-local tests (same algorithm as TokenService).
 * Usage: node scripts/smoke-sign-invite-token.mjs <inviteId> <organizationId> <email>
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

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

const require = createRequire(path.join(ROOT, "apps/api/package.json"));
const { SignJWT } = require("jose");

const [inviteId, organizationId, email] = process.argv.slice(2);
if (!inviteId || !organizationId || !email) {
  console.error("Usage: smoke-sign-invite-token.mjs <inviteId> <organizationId> <email>");
  process.exit(1);
}

const secret = process.env.JWT_REFRESH_SECRET;
if (!secret) {
  console.error("JWT_REFRESH_SECRET is required (set in .env or environment)");
  process.exit(1);
}

const key = new TextEncoder().encode(`${secret}:invite`);
const token = await new SignJWT({ inviteId, organizationId, email })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("7d")
  .sign(key);

process.stdout.write(token);
