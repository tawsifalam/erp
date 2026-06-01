# Visual guide assets

PNG screenshots and the generated PDF are **gitignored**. Regenerate locally when needed.

```bash
# 1) Capture UI — module overviews + step-by-step form flows (mocked API)
pnpm test:visual-guide

# 2) Build printable PDF (includes all PNGs + guide text)
pnpm generate:visual-guide-pdf

# Or both:
pnpm visual-guide
```

**Output**

| Artifact | Path | In git? |
|----------|------|---------|
| Module screenshots | `docs/visual/screenshots/*.png` | No |
| Step-by-step flows | `docs/visual/screenshots/flows/*/*.png` | No |
| PDF | `docs/hospitality-erp-visual-guide.pdf` | No |
| Source doc | `docs/visual-guide.md` | Yes |

Optional: watch the browser with `pnpm --filter @erp/web test:visual-guide:headed`.

### PDF fails with “Could not find Chrome”

`md-to-pdf` needs a Chrome/Chromium binary. The generator looks for, in order:

1. `CHROME_PATH` or `PUPPETEER_EXECUTABLE_PATH`
2. System Google Chrome (macOS `/Applications/Google Chrome.app/…`)
3. Playwright’s browser (`pnpm test:e2e:install`)
4. Puppeteer’s cache (`npx puppeteer browsers install chrome`)

Example:

```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm generate:visual-guide-pdf
```
