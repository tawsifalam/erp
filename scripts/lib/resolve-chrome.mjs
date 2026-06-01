/**
 * Resolve a Chrome/Chromium binary for md-to-pdf (Puppeteer).
 * Prefers env override, then system Chrome, then Playwright's browser, then Puppeteer cache.
 */
import { access, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { homedir, platform } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

const SYSTEM_CANDIDATES = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  linux: [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
};

async function firstExisting(paths) {
  for (const p of paths) {
    if (await exists(p)) return p;
  }
  return undefined;
}

async function fromPlaywright() {
  const packageRoots = [
    path.join(ROOT, "apps/web"),
    ROOT,
  ];
  for (const root of packageRoots) {
    const pkgJson = path.join(root, "package.json");
    if (!(await exists(pkgJson))) continue;
    try {
      const require = createRequire(pkgJson);
      const { chromium } = require("playwright");
      const exe = chromium.executablePath();
      if (exe && (await exists(exe))) return exe;
    } catch {
      // playwright not installed in this package root
    }
  }
  return undefined;
}

/** Puppeteer 25+ cache under ~/.cache/puppeteer/chrome/ */
async function fromPuppeteerCache() {
  const cacheRoot = path.join(homedir(), ".cache", "puppeteer", "chrome");
  if (!(await exists(cacheRoot))) return undefined;

  const platformDirs = await readdir(cacheRoot, { withFileTypes: true });
  for (const entry of platformDirs) {
    if (!entry.isDirectory()) continue;
    const versionDir = path.join(cacheRoot, entry.name);
    let versions;
    try {
      versions = await readdir(versionDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ver of versions) {
      if (!ver.isDirectory()) continue;
      const base = path.join(versionDir, ver.name);
      const candidates =
        platform() === "darwin"
          ? [
              path.join(
                base,
                "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
              ),
              path.join(
                base,
                "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
              ),
              path.join(base, "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
            ]
          : platform() === "win32"
            ? [path.join(base, "chrome-win64/chrome.exe"), path.join(base, "chrome-win32/chrome.exe")]
            : [
                path.join(base, "chrome-linux64/chrome"),
                path.join(base, "chrome-linux/chrome"),
              ];
      const found = await firstExisting(candidates);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * @returns {Promise<string | undefined>}
 */
export async function resolveChromeExecutable() {
  const fromEnv = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && (await exists(fromEnv))) return fromEnv;

  const osKey = platform();
  const system = await firstExisting(SYSTEM_CANDIDATES[osKey] ?? []);
  if (system) return system;

  const playwright = await fromPlaywright();
  if (playwright) return playwright;

  return fromPuppeteerCache();
}

export function chromeNotFoundMessage() {
  return `Could not find Chrome/Chromium for PDF generation.

Try one of:
  1. Install Google Chrome (recommended — same as Playwright E2E)
  2. Run: pnpm test:e2e:install   (Playwright browsers)
  3. Run: npx puppeteer browsers install chrome
  4. Set CHROME_PATH to your chrome binary, e.g.:
     CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm generate:visual-guide-pdf`;
}
