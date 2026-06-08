#!/usr/bin/env node
/**
 * Run local smoke tests: ensure API + web are up, run setup, then Playwright.
 * See docs/smoke-local.md
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const API_HEALTH = "http://localhost:3001/api/health";
const WEB_URL = "http://localhost:3000";
const MINIO_HEALTH = "http://localhost:9000/minio/health/live";
const COMPOSE_FILE = path.join(ROOT, "infra/docker/docker-compose.yml");

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

const children = [];

function track(child) {
  children.push(child);
  return child;
}

function cleanup() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

async function isReachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function waitFor(url, label, attempts = 90) {
  for (let i = 0; i < attempts; i++) {
    if (await isReachable(url)) {
      console.log(`${label} ready at ${url}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = track(
      spawn(command, args, {
        cwd: ROOT,
        stdio: "inherit",
        shell: true,
        env: process.env,
        ...options,
      }),
    );
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function ensureInfrastructure() {
  if (await isReachable(MINIO_HEALTH)) {
    console.log("MinIO ready");
    return;
  }

  console.log("MinIO not reachable — starting Docker services (postgres, redis, minio)…");
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(
        "docker",
        ["compose", "-f", COMPOSE_FILE, "up", "-d", "postgres", "redis", "minio"],
        { cwd: ROOT, stdio: "inherit", shell: true, env: process.env },
      );
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`docker compose exited with code ${code}`));
      });
    });
    await waitFor(MINIO_HEALTH, "MinIO", 30);
  } catch (err) {
    throw new Error(
      `MinIO is required for report exports (smoke-local-06/07). ${err?.message ?? err}\n` +
        "Start manually: docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio",
    );
  }
}

async function ensureServers() {
  const apiUp = await isReachable(API_HEALTH);
  const webUp = await isReachable(WEB_URL);

  if (!apiUp) {
    console.log("Starting API on :3001…");
    track(
      spawn("pnpm", ["--filter", "@erp/api", "dev"], {
        cwd: ROOT,
        stdio: "ignore",
        shell: true,
        env: process.env,
      }),
    );
    await waitFor(API_HEALTH, "API");
  } else {
    console.log("Reusing API on :3001");
  }

  if (!webUp) {
    console.log("Starting web on :3000…");
    track(
      spawn("pnpm", ["--filter", "@erp/web", "dev"], {
        cwd: ROOT,
        stdio: "ignore",
        shell: true,
        env: process.env,
      }),
    );
    await waitFor(WEB_URL, "Web");
  } else {
    console.log("Reusing web on :3000");
  }
}

async function main() {
  await ensureInfrastructure();
  await ensureServers();
  await run("node", ["scripts/smoke-local-setup.mjs"]);
  await run("pnpm", ["--filter", "@erp/web", "test:smoke-local"]);
}

main()
  .then(() => {
    cleanup();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err.message ?? err);
    cleanup();
    process.exit(1);
  });
