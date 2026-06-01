#!/usr/bin/env node
/**
 * Build docs/hospitality-erp-visual-guide.pdf from visual-guide.md + local screenshots.
 * Screenshots are gitignored — run pnpm test:visual-guide first.
 */
import { access, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mdToPdf } from "md-to-pdf";
import { chromeNotFoundMessage, resolveChromeExecutable } from "./lib/resolve-chrome.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const MD_PATH = path.join(DOCS, "visual-guide.md");
const PDF_PATH = path.join(DOCS, "hospitality-erp-visual-guide.pdf");
const SCREENSHOT_DIR = path.join(DOCS, "visual", "screenshots");

const REQUIRED_SCREENSHOTS = [
  "01-dashboard.png",
  "02-pms-reservations.png",
  "03-pms-rooms.png",
  "04-pms-rates.png",
  "05-pos.png",
  "06-kitchen.png",
  "07-inventory.png",
  "08-procurement-vendors.png",
  "09-procurement-orders.png",
  "10-accounting.png",
  "11-hr.png",
  "12-reports.png",
  "13-settings-organization.png",
  "14-settings-team.png",
  "15-settings-audit.png",
];

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Minimum flows that must exist before PDF build (full list in visual-guide.md). */
const REQUIRED_FLOW_DIRS = [
  "pms-room-type",
  "pms-room",
  "pms-guest",
  "pms-guest-package",
  "pms-rate-plan",
  "pms-new-reservation",
  "pms-reservation-lifecycle",
  "procurement-po-receive",
  "pos-order-lifecycle",
  "inventory-stock",
  "accounting-post-journal",
  "settings-admin",
];

const MIN_FLOW_DIR_COUNT = 18;

async function ensureScreenshots() {
  const missing = [];
  for (const name of REQUIRED_SCREENSHOTS) {
    if (!(await fileExists(path.join(SCREENSHOT_DIR, name)))) {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    console.error("Missing module screenshots (run pnpm test:visual-guide first):");
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }

  const flowsRoot = path.join(SCREENSHOT_DIR, "flows");
  if (!(await fileExists(flowsRoot))) {
    console.error("Missing docs/visual/screenshots/flows/ — run pnpm test:visual-guide");
    process.exit(1);
  }

  const entries = await readdir(flowsRoot, { withFileTypes: true });
  const flowDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  for (const dir of REQUIRED_FLOW_DIRS) {
    if (!flowDirs.includes(dir)) {
      console.error(`Missing flow screenshots folder: flows/${dir}/`);
      process.exit(1);
    }
    const steps = await readdir(path.join(flowsRoot, dir));
    const pngs = steps.filter((f) => f.endsWith(".png"));
    if (pngs.length < 2) {
      console.error(`Flow flows/${dir}/ has too few steps (${pngs.length})`);
      process.exit(1);
    }
  }
  if (flowDirs.length < MIN_FLOW_DIR_COUNT) {
    console.error(
      `Expected at least ${MIN_FLOW_DIR_COUNT} flow folders, found ${flowDirs.length}. Run pnpm test:visual-guide`,
    );
    process.exit(1);
  }
  console.log(`Found ${flowDirs.length} step-by-step flows under screenshots/flows/`);
}

/**
 * md-to-pdf uses page.setContent(), so file-relative and HTTP image URLs are unreliable
 * (relative paths break; many images may not finish loading before PDF print).
 * Inline PNGs as data URLs so every screenshot is embedded.
 */
/** Resolve PNG on disk (supports legacy double-prefixed flow files from older captures). */
async function resolveScreenshotPath(rel) {
  const direct = path.join(SCREENSHOT_DIR, rel);
  if (await fileExists(direct)) return direct;

  const base = path.basename(rel);
  const dir = path.dirname(rel);
  const legacy = base.match(/^(\d{2})-(.+)\.png$/);
  if (legacy) {
    const legacyPath = path.join(SCREENSHOT_DIR, dir, `${legacy[1]}-${legacy[1]}-${legacy[2]}.png`);
    if (await fileExists(legacyPath)) return legacyPath;
  }

  throw new Error(`Screenshot not found: ${rel} (run pnpm test:visual-guide)`);
}

async function embedScreenshotDataUrls(markdown) {
  const relPaths = new Set();
  const pattern = /\]\(\.\/visual\/screenshots\/([^)]+)\)/g;
  for (const match of markdown.matchAll(pattern)) {
    relPaths.add(match[1]);
  }

  const dataUrlByRel = new Map();
  for (const rel of relPaths) {
    const abs = await resolveScreenshotPath(rel);
    const buf = await readFile(abs);
    dataUrlByRel.set(rel, `data:image/png;base64,${buf.toString("base64")}`);
  }

  return markdown.replace(
    /\]\(\.\/visual\/screenshots\/([^)]+)\)/g,
    (_, rel) => `](${dataUrlByRel.get(rel)})`,
  );
}

/** Mermaid does not render in md-to-pdf; replace with short text for print. */
async function prepareMarkdownForPdf(source) {
  let markdown = source
    .replace(
      /```mermaid[\s\S]*?```/g,
      "\n> *Flow diagram — open `docs/visual-guide.md` in GitHub or an editor with Mermaid preview.*\n",
    )
    .replace(
      /## Regenerate screenshots[\s\S]*?---\n\n## Application map/,
      "## Application map",
    )
    .concat(
      "\n\n---\n\n*Generated from `docs/visual-guide.md`. Screenshots: `docs/visual/screenshots/` (local only, not in git).*\n",
    );

  console.log(`Inlining ${[...markdown.matchAll(/\]\(\.\/visual\/screenshots\//g)].length} screenshots…`);
  return embedScreenshotDataUrls(markdown);
}

async function main() {
  await ensureScreenshots();

  if (!(await fileExists(MD_PATH))) {
    console.error(`Not found: ${MD_PATH}`);
    process.exit(1);
  }

  let markdown = await readFile(MD_PATH, "utf8");
  markdown = await prepareMarkdownForPdf(markdown);

  const tmpMd = path.join(DOCS, ".visual-guide-pdf-tmp.md");
  await writeFile(tmpMd, markdown, "utf8");

  const chromePath = await resolveChromeExecutable();
  if (!chromePath) {
    console.error(chromeNotFoundMessage());
    process.exit(1);
  }
  console.log(`Using Chrome: ${chromePath}`);

  try {
    console.log("Generating PDF…");
    await mdToPdf(
      { path: tmpMd },
      {
        dest: PDF_PATH,
        basedir: DOCS,
        launch_options: {
          executablePath: chromePath,
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
        css: `
          body { font-family: system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
          h1 { font-size: 22pt; border-bottom: 2px solid #2563eb; padding-bottom: 0.3em; }
          h2 { font-size: 16pt; margin-top: 1.2em; color: #1e40af; page-break-before: auto; }
          h3 { font-size: 13pt; }
          img { max-width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 6px; margin: 0.5em 0; }
          table { border-collapse: collapse; width: 100%; font-size: 10pt; }
          th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
          th { background: #f3f4f6; }
          blockquote { color: #4b5563; border-left: 3px solid #93c5fd; padding-left: 12px; }
          code { font-size: 9pt; background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }
          pre { font-size: 9pt; }
        `,
        pdf_options: {
          format: "A4",
          margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
          printBackground: true,
        },
      },
    );
    console.log(`Wrote ${path.relative(ROOT, PDF_PATH)}`);
  } finally {
    await unlink(tmpMd).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
