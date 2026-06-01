# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rates.spec.ts >> PMS rate plans >> can create a new rate plan
- Location: e2e/rates.spec.ts:24:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3000/pms?tab=rates", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { setupE2ePage } from "./helpers/setup";
  3   | import { pickAppSelectInDrawer } from "./helpers/app-select";
  4   | import { clickRowAction } from "./helpers/row-actions";
  5   | 
  6   | test.describe("PMS rate plans", () => {
  7   |   test.beforeEach(async ({ page }) => {
  8   |     await setupE2ePage(page);
  9   |   });
  10  | 
  11  |   test("rates tab lists seed plan with weekend rule", async ({ page }) => {
  12  |     await page.goto("/pms?tab=rates");
  13  |     await expect(page.getByRole("tab", { name: "Rates" })).toBeVisible();
  14  |     await expect(page.getByRole("cell", { name: "Summer standard" })).toBeVisible({
  15  |       timeout: 15_000,
  16  |     });
  17  |     await expect(page.getByRole("cell", { name: "Summer standard" })).toBeVisible();
  18  |     await expect(page.getByRole("cell", { name: "Standard Double" }).first()).toBeVisible();
  19  |     await page.getByRole("button", { name: "Rules" }).first().click();
  20  |     await expect(page.getByRole("cell", { name: "Saturday" })).toBeVisible();
  21  |     await expect(page.getByRole("cell", { name: "৳5,000" })).toBeVisible();
  22  |   });
  23  | 
  24  |   test("can create a new rate plan", async ({ page }) => {
> 25  |     await page.goto("/pms?tab=rates");
      |                ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  26  |     await expect(page.getByRole("cell", { name: "Summer standard" })).toBeVisible({
  27  |       timeout: 15_000,
  28  |     });
  29  |     await page.getByRole("button", { name: "+ Add rate plan" }).click();
  30  |     await expect(page.getByRole("heading", { name: "New rate plan" })).toBeVisible();
  31  |     await page.getByLabel("Name").fill("Winter promo");
  32  |     await page.getByRole("button", { name: "Save" }).click();
  33  |     await expect(page.getByRole("cell", { name: "Winter promo" })).toBeVisible({
  34  |       timeout: 10_000,
  35  |     });
  36  |   });
  37  | 
  38  |   test("full board rate plan adds F&B supplement to weekday quote", async ({ page }) => {
  39  |     await page.goto("/pms");
  40  |     await page.getByRole("button", { name: "+ New reservation" }).click();
  41  |     await pickAppSelectInDrawer(page, "New reservation", 1, "Karim Uddin");
  42  |     await page.locator('input[type="date"]').nth(0).fill("2026-06-02");
  43  |     await page.locator('input[type="date"]').nth(1).fill("2026-06-04");
  44  |     await pickAppSelectInDrawer(page, "New reservation", 2, /102.*Standard/);
  45  |     await page.waitForResponse(
  46  |       (r) => r.url().includes("/pms/pricing/quote") && r.ok(),
  47  |       { timeout: 15_000 },
  48  |     );
  49  |     await expect(page.getByText(/Rate plan: Summer full board/i)).toBeVisible({
  50  |       timeout: 10_000,
  51  |     });
  52  |     await expect(page.getByTestId("reservation-total-amount")).toHaveValue("10200", {
  53  |       timeout: 10_000,
  54  |     });
  55  |   });
  56  | 
  57  |   test("weekend stay quotes higher total than weekday in reservation drawer", async ({
  58  |     page,
  59  |   }) => {
  60  |     await page.goto("/pms");
  61  |     await page.getByRole("button", { name: "+ New reservation" }).click();
  62  |     await pickAppSelectInDrawer(page, "New reservation", 1, "Karim Uddin");
  63  |     await page.locator('input[type="date"]').nth(0).fill("2026-06-05");
  64  |     await page.locator('input[type="date"]').nth(1).fill("2026-06-07");
  65  |     await pickAppSelectInDrawer(page, "New reservation", 2, /102.*Standard/);
  66  |     await page.waitForResponse(
  67  |       (r) => r.url().includes("/pms/pricing/quote") && r.ok(),
  68  |       { timeout: 15_000 },
  69  |     );
  70  |     await expect(page.getByText(/Rate plan:/i)).toBeVisible({
  71  |       timeout: 10_000,
  72  |     });
  73  |     const totalInput = page.getByTestId("reservation-total-amount");
  74  |     await expect(totalInput).toHaveValue("8500", { timeout: 10_000 });
  75  | 
  76  |     await page.locator('input[type="date"]').nth(0).fill("2026-06-02");
  77  |     await page.locator('input[type="date"]').nth(1).fill("2026-06-04");
  78  |     await expect(totalInput).toHaveValue("7000", { timeout: 10_000 });
  79  |   });
  80  | 
  81  |   test("creating reservation uses quoted total in table", async ({ page }) => {
  82  |     await page.goto("/pms");
  83  |     await page.getByRole("button", { name: "+ New reservation" }).click();
  84  |     await pickAppSelectInDrawer(page, "New reservation", 1, "Karim Uddin");
  85  |     await page.locator('input[type="date"]').nth(0).fill("2026-07-10");
  86  |     await page.locator('input[type="date"]').nth(1).fill("2026-07-12");
  87  |     await pickAppSelectInDrawer(page, "New reservation", 2, /102.*Standard/);
  88  |     await page.waitForResponse(
  89  |       (r) => r.url().includes("/pms/pricing/quote") && r.ok(),
  90  |       { timeout: 15_000 },
  91  |     );
  92  |     await expect(page.getByTestId("reservation-total-amount")).toHaveValue("7000", {
  93  |       timeout: 10_000,
  94  |     });
  95  |     await page.getByRole("button", { name: "Create" }).click();
  96  |     await expect(page.getByRole("row").filter({ hasText: "Karim Uddin" }).getByText("7,000")).toBeVisible({
  97  |       timeout: 10_000,
  98  |     });
  99  |   });
  100 | 
  101 |   test("editing reservation dates recalculates total", async ({ page }) => {
  102 |     await page.goto("/pms");
  103 |     const row = page
  104 |       .getByRole("row")
  105 |       .filter({ hasText: "INQUIRY" })
  106 |       .filter({ hasText: "102" });
  107 |     await clickRowAction(row, "Edit");
  108 |     await expect(page.getByRole("heading", { name: "Edit reservation" })).toBeVisible();
  109 |     await page.locator('input[type="date"]').nth(0).fill("2026-06-05");
  110 |     await page.locator('input[type="date"]').nth(1).fill("2026-06-07");
  111 |     await page.waitForResponse(
  112 |       (r) => r.url().includes("/pms/pricing/quote") && r.ok(),
  113 |       { timeout: 15_000 },
  114 |     );
  115 |     const totalInput = page.getByTestId("reservation-total-amount");
  116 |     await expect(totalInput).toHaveValue("8500", { timeout: 10_000 });
  117 |     await page.getByRole("button", { name: "Save" }).click();
  118 |     await expect(row.getByText("8,500")).toBeVisible({ timeout: 10_000 });
  119 |   });
  120 | });
  121 | 
```