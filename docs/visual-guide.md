# Hospitality ERP — Visual guide

Module-by-module tour of the Phase 1 app: what each area does, how data flows, and where to go deeper.

| Source | Role |
|--------|------|
| **This doc** | Maps, journeys, screenshot index |
| **[app-workflow-guide.md](./app-workflow-guide.md)** | API steps, curl, business rules |
| **E2E specs** | `visual-guide.spec.ts` (pages), `visual-guide-flows-pms.spec.ts` + `visual-guide-flows.spec.ts` (step-by-step) |
| **Module docs** | `docs/*-module.md` |

---

## PDF export

**Printable guide (local only, not in git):** `docs/hospitality-erp-visual-guide.pdf`

```bash
pnpm test:visual-guide              # screenshots → docs/visual/screenshots/ (gitignored)
pnpm generate:visual-guide-pdf        # builds the PDF above (gitignored)
# or both:
pnpm visual-guide
```

Open the PDF after generation, or attach it to releases / email manually. Regenerate whenever the UI or this guide changes.

## Regenerate screenshots

```bash
pnpm dev   # optional — Playwright can start web-only on :3000
pnpm test:visual-guide
```

See [visual/README.md](./visual/README.md). Screenshots use **mocked API** data (consistent demo UI, not your production DB).

---

## Application map

```mermaid
flowchart TB
  subgraph auth [Auth and tenant]
    PA[PropelAuth login]
    Sync[POST /auth/sync]
    Tenant[X-Organization-Id + X-Branch-Id]
  end

  subgraph ops [Operations]
    PMS[PMS]
    POS[POS]
    KIT[Kitchen]
  end

  subgraph supply [Supply chain]
    INV[Inventory]
    PROC[Procurement]
  end

  subgraph finance [Finance and people]
    ACC[Accounting]
    HR[HR and payroll]
    RPT[Reports]
  end

  subgraph admin [Admin]
    SET[Settings]
  end

  PA --> Sync --> Tenant
  Tenant --> PMS
  Tenant --> POS
  POS --> KIT
  Tenant --> INV
  PROC --> INV
  INV --> ACC
  PMS --> ACC
  POS --> ACC
  HR --> ACC
  Tenant --> RPT
  Tenant --> SET
```

### Sidebar modules (ADMIN view)

| Route | Module | Permission |
|-------|--------|------------|
| `/dashboard` | Overview KPIs | Dashboard access |
| `/pms` | Property management | `pms:read` |
| `/pos` | Point of sale | `pos:read` |
| `/pos/kitchen` | Kitchen display | `pos:read` |
| `/inventory` | Stock and recipes | `inventory:read` |
| `/procurement` | Vendors and POs | `inventory:read` |
| `/accounting` | CoA and journals | `accounting:read` |
| `/hr` | HR and payroll | `hr:read` |
| `/reports` | CSV exports | `reports:read` |
| `/settings` | Org, team, audit | `admin:*` |

Role-scoped users see a subset (e.g. `FRONT_DESK` → PMS only). See [organization-onboarding.md](./organization-onboarding.md).

---

## End-to-end journeys

### New staff joins the organization

```mermaid
sequenceDiagram
  participant Admin
  participant App
  participant PA as PropelAuth
  participant Staff

  Admin->>App: Settings → Invite by email
  App->>PA: inviteUserToOrg
  Staff->>PA: Accept email / signup
  Staff->>App: Login
  App->>App: POST /auth/sync
  App->>App: Fulfill OrganizationInvite → UserOrganization
  Staff->>App: Role-scoped home (e.g. /pms)
```

Alternative: **join code** → pending request → admin approves with role ([settings Team tab](./settings-module.md)).

**E2E:** `settings.spec.ts`, `onboarding.spec.ts` · **Screenshot:** `14-settings-team.png`

---

### Guest stay (PMS)

```mermaid
flowchart LR
  A[Create guest] --> B[Reservation INQUIRY]
  B --> C[Confirm]
  C --> D[Check in]
  D --> E[Inclusions / packages]
  E --> F[Check out]
  F --> G[Room DIRTY → VACANT]
```

Rate plans and F&B bundles compute `totalAmount` on book/date change (`GET /pms/pricing/quote`).

**E2E:** `pms-flow.spec.ts`, `rates.spec.ts` · **Screenshots:** `02-pms-reservations.png`, `04-pms-rates.png`

---

### Restaurant order (POS → kitchen)

```mermaid
flowchart LR
  M[Menu / cart] --> O[Submit order]
  O --> K[Kitchen ticket]
  K --> R[Ready]
  R --> P[Pay / complete]
  P --> J[GL revenue + COGS]
```

**E2E:** `pos.spec.ts`, `kitchen.spec.ts` · **Screenshots:** `05-pos.png`, `06-kitchen.png`

---

### Buy stock (procurement)

```mermaid
flowchart LR
  V[Vendor] --> PO[PO DRAFT]
  PO --> S[SUBMITTED]
  S --> R[Receive goods]
  R --> I[Inventory IN movement]
  R --> J[Dr Inventory / Cr AP]
```

**E2E:** `procurement.spec.ts` · **Screenshots:** `08-procurement-vendors.png`, `09-procurement-orders.png`

---

### Payroll

```mermaid
flowchart LR
  E[Employees] --> A[Attendance]
  A --> Run[Payroll run queue]
  Run --> GL[Salary expense / payable journals]
  Run --> PDF[Payslip PDF download]
```

**E2E:** `hr.spec.ts` · **Screenshot:** `11-hr.png`

---

## Step-by-step form flows

Captured by Playwright into `docs/visual/screenshots/flows/{flow-name}/` (numbered `01-`, `02-`, …). **Screenshots and PDF are gitignored** — regenerate locally with `pnpm visual-guide`.

| Spec | Modules |
|------|---------|
| `visual-guide-flows-pms.spec.ts` | PMS setup + operations (order below) |
| `visual-guide-flows.spec.ts` | Procurement, inventory, POS, HR, accounting, settings, reports |

> Drawer steps crop the open form. List steps show the full page for context.

### PMS — recommended setup order

Create master data **before** reservations. Room and rate plan forms require a **room type**; rate plans can optionally attach a **guest package** (F&B bundle).

```mermaid
flowchart TD
  RT[1. Room types] --> R[2. Rooms]
  G[3. Guests] --> RES[7. Reservations]
  IR[4a. Inclusion recipes] --> PKG[4b. Guest packages]
  PKG --> RP[5. Rate plans + rules]
  R --> RES
  RP --> RES
  RES --> LC[8. Confirm / check-in / check-out]
  LC --> HK[9. Housekeeping on Rooms tab]
  RES --> PAY[10. Record payment]
  RES --> INC[11. Guest inclusions when in-house]
```

| Order | Tab | Action | Depends on |
|------|-----|--------|------------|
| 1 | **Room types** | **+ Add room type** | — |
| 2 | **Rooms** | **+ Add room** (number, type, base price) | Room type |
| 3 | **Guests** | **+ Add guest** | — |
| 4a | **Guest packages** | **+ New recipe** (meal / amenity BOM) | Inventory items (pools) |
| 4b | **Guest packages** | **+ New package** (meals/night, recipes) | Inclusion recipes |
| 5 | **Rates** | **+ Add rate plan** (room type, dates, optional package) | Room type, optional package |
| 5b | **Rates** | **Rules** on a plan row (day, min stay, price override) | Rate plan |
| 6 | **Reservations** | **+ New reservation** | Guest, room, dates (pricing quote) |
| 7 | Row actions | Confirm → Check in → Check out | Reservation status |
| 8 | **Rooms** | **→ VACANT** after checkout (DIRTY → vacant) | Checked-out room |
| 9 | Row | **Payment** | Reservation with balance |
| 10 | Row | **Inclusions** | Checked-in guest with package |

### PMS — Room type (`flows/pms-room-type/`)

| Step | What you do |
|------|-------------|
| 1 | **PMS → Room types** |
| 2 | **+ Add room type** |
| 3 | Name, max adults/children → **Create** |

![Step 1](./visual/screenshots/flows/pms-room-type/01-room-types-list.png)
![Step 2](./visual/screenshots/flows/pms-room-type/02-drawer-empty.png)
![Step 3](./visual/screenshots/flows/pms-room-type/03-fields-filled.png)

### PMS — Room (`flows/pms-room/`)

| Step | What you do |
|------|-------------|
| 1 | **PMS → Rooms** |
| 2 | **+ Add room** |
| 3 | Room number, **room type**, price/night → **Create** |

![Step 1](./visual/screenshots/flows/pms-room/01-rooms-list.png)
![Step 2](./visual/screenshots/flows/pms-room/02-drawer-empty.png)
![Step 3](./visual/screenshots/flows/pms-room/03-type-and-price-filled.png)

### PMS — Guest (`flows/pms-guest/`)

| Step | What you do |
|------|-------------|
| 1 | **PMS → Guests** |
| 2 | **+ Add guest** |
| 3 | Full name, phone, email → **Create** |

![Step 1](./visual/screenshots/flows/pms-guest/01-guests-list.png)
![Step 2](./visual/screenshots/flows/pms-guest/02-drawer-empty.png)
![Step 3](./visual/screenshots/flows/pms-guest/03-contact-filled.png)

### PMS — Inclusion recipe (`flows/pms-inclusion-recipe/`)

| Step | What you do |
|------|-------------|
| 1 | **PMS → Guest packages** (recipes table at top) |
| 2 | **+ New recipe** |
| 3 | Name, type (meal vs amenity), ingredient lines → **Save recipe** |

![Step 1](./visual/screenshots/flows/pms-inclusion-recipe/01-packages-and-recipes.png)
![Step 2](./visual/screenshots/flows/pms-inclusion-recipe/02-new-recipe-drawer.png)
![Step 3](./visual/screenshots/flows/pms-inclusion-recipe/03-recipe-name-filled.png)

### PMS — Guest package (`flows/pms-guest-package/`)

| Step | What you do |
|------|-------------|
| 1 | **Guest packages** list |
| 2 | **+ New package** |
| 3 | Package name, meals/night, **meal recipe**, optional amenity → **Create package** |

![Step 1](./visual/screenshots/flows/pms-guest-package/01-existing-packages.png)
![Step 2](./visual/screenshots/flows/pms-guest-package/02-drawer-empty.png)
![Step 3](./visual/screenshots/flows/pms-guest-package/03-meal-allowance-filled.png)

### PMS — Rate plan & rules (`flows/pms-rate-plan/`)

| Step | What you do |
|------|-------------|
| 1 | **PMS → Rates** |
| 2 | **+ Add rate plan** — room type, validity, base modifier |
| 3 | Optional **guest package** + F&B supplement per guest/night |
| 4 | **Rules** on a plan — day-of-week / min stay / price override |

![Step 1](./visual/screenshots/flows/pms-rate-plan/01-rates-list.png)
![Step 2](./visual/screenshots/flows/pms-rate-plan/02-new-plan-drawer.png)
![Step 3](./visual/screenshots/flows/pms-rate-plan/03-plan-with-package.png)
![Step 4](./visual/screenshots/flows/pms-rate-plan/04-rules-panel.png)

### PMS — New reservation (`flows/pms-new-reservation/`)

| Step | What you do |
|------|-------------|
| 1 | Open **PMS → Reservations** |
| 2 | Click **+ New reservation** (empty drawer) |
| 3 | Select **guest** |
| 4 | Set **check-in / check-out** dates |
| 5 | Select **room** — rate plan quote and total appear |

![Step 1](./visual/screenshots/flows/pms-new-reservation/01-reservations-list.png)
![Step 2](./visual/screenshots/flows/pms-new-reservation/02-drawer-empty.png)
![Step 3](./visual/screenshots/flows/pms-new-reservation/03-guest-selected.png)
![Step 4](./visual/screenshots/flows/pms-new-reservation/04-dates-set.png)
![Step 5](./visual/screenshots/flows/pms-new-reservation/05-room-and-pricing.png)

### PMS — Reservation lifecycle (`flows/pms-reservation-lifecycle/`)

| Step | What you do |
|------|-------------|
| 1 | Inquiry on list |
| 2 | **Confirm** → CONFIRMED |
| 3 | **Check in** → CHECKED_IN |
| 4 | **Check out** → CHECKED_OUT |
| 5 | **Rooms** tab — room **DIRTY** |
| 6 | **→ VACANT** housekeeping |

![Step 1](./visual/screenshots/flows/pms-reservation-lifecycle/01-inquiry-on-list.png)
![Step 2](./visual/screenshots/flows/pms-reservation-lifecycle/02-confirmed.png)
![Step 3](./visual/screenshots/flows/pms-reservation-lifecycle/03-checked-in.png)
![Step 4](./visual/screenshots/flows/pms-reservation-lifecycle/04-checked-out.png)
![Step 5](./visual/screenshots/flows/pms-reservation-lifecycle/05-room-dirty.png)
![Step 6](./visual/screenshots/flows/pms-reservation-lifecycle/06-room-vacant.png)

### PMS — Guest inclusions (`flows/pms-guest-inclusions/`)

| Step | What you do |
|------|-------------|
| 1 | On a **CHECKED_IN** row, **Inclusions** — meal allowance / comp meal |

![Step 1](./visual/screenshots/flows/pms-guest-inclusions/01-inclusions-drawer.png)

### PMS — Record payment (`flows/pms-record-payment/`)

| Step | What you do |
|------|-------------|
| 1 | Find reservation on the list |
| 2 | Click **Payment** on the row |
| 3 | Enter amount → **Save** |

![Step 1](./visual/screenshots/flows/pms-record-payment/01-list-before-payment.png)
![Step 2](./visual/screenshots/flows/pms-record-payment/02-payment-drawer.png)
![Step 3](./visual/screenshots/flows/pms-record-payment/03-amount-entered.png)

### Procurement — Add vendor (`flows/procurement-add-vendor/`)

| Step | What you do |
|------|-------------|
| 1 | **Procurement → Vendors** |
| 2 | **+ Add vendor** |
| 3 | Name, contact → **Save** |

![Step 1](./visual/screenshots/flows/procurement-add-vendor/01-vendors-list.png)
![Step 2](./visual/screenshots/flows/procurement-add-vendor/02-add-vendor-drawer.png)
![Step 3](./visual/screenshots/flows/procurement-add-vendor/03-fields-filled.png)

### Procurement — PO create & receive (`flows/procurement-po-receive/`)

| Step | What you do |
|------|-------------|
| 1 | **Purchase orders** tab |
| 2 | **+ New PO** |
| 3 | Choose **vendor** |
| 4 | Add **line** (item, qty, unit price) |
| 5 | **Create & submit** → status SUBMITTED |
| 6 | **Receive** on the PO |
| 7 | Select line, enter qty → **Receive** (stock + AP journal on real API) |

![Step 1](./visual/screenshots/flows/procurement-po-receive/01-po-list.png)
![Step 2](./visual/screenshots/flows/procurement-po-receive/02-new-po-drawer.png)
![Step 3](./visual/screenshots/flows/procurement-po-receive/03-vendor-selected.png)
![Step 4](./visual/screenshots/flows/procurement-po-receive/04-line-filled.png)
![Step 5](./visual/screenshots/flows/procurement-po-receive/05-po-submitted.png)
![Step 6](./visual/screenshots/flows/procurement-po-receive/06-receive-drawer.png)
![Step 7](./visual/screenshots/flows/procurement-po-receive/07-receive-qty-filled.png)

### Inventory — Items & movements (`flows/inventory-stock/`)

| Step | What you do |
|------|-------------|
| 1 | **Inventory** stock list |
| 2 | **+ New item** (drawer) |
| 3 | Fill SKU, name, unit |
| 4 | **+ Record movement** (drawer) |
| 5 | Item, qty, direction → **Record** |

![Step 1](./visual/screenshots/flows/inventory-stock/01-stock-list.png)
![Step 2](./visual/screenshots/flows/inventory-stock/02-new-item-drawer.png)
![Step 3](./visual/screenshots/flows/inventory-stock/03-item-fields-filled.png)
![Step 4](./visual/screenshots/flows/inventory-stock/04-movement-drawer.png)
![Step 5](./visual/screenshots/flows/inventory-stock/05-movement-filled.png)

### POS — Order lifecycle (`flows/pos-order-lifecycle/`)

| Step | What you do |
|------|-------------|
| 1 | **POS → Orders** (draft order) |
| 2 | **Send to kitchen** → SUBMITTED |
| 3 | **Complete & pay** → payment drawer → **Complete** |

![Step 1](./visual/screenshots/flows/pos-order-lifecycle/01-orders-draft.png)
![Step 2](./visual/screenshots/flows/pos-order-lifecycle/02-after-send-kitchen.png)
![Step 3](./visual/screenshots/flows/pos-order-lifecycle/03-complete-pay-drawer.png)

### POS — Menu category (`flows/pos-menu-category/`)

| Step | What you do |
|------|-------------|
| 1 | **POS → Menu** |
| 2 | **+ Add category** → name → **Create** |

![Step 1](./visual/screenshots/flows/pos-menu-category/01-menu-tab.png)
![Step 2](./visual/screenshots/flows/pos-menu-category/02-new-category-filled.png)

### Inventory — Recipe BOM (`flows/inventory-recipe/`)

| Step | What you do |
|------|-------------|
| 1 | **Inventory → Recipes (BOM)** (menu items from POS first) |
| 2 | **Edit recipe** on a menu item — ingredient lines → **Save recipe** |

![Step 1](./visual/screenshots/flows/inventory-recipe/01-recipes-list.png)
![Step 2](./visual/screenshots/flows/inventory-recipe/02-bom-drawer.png)

### Accounting — Add account (`flows/accounting-add-account/`)

| Step | What you do |
|------|-------------|
| 1 | **Accounting → Chart of accounts** |
| 2 | **+ Add account** |
| 3 | Code, name, type → **Create** |

![Step 1](./visual/screenshots/flows/accounting-add-account/01-chart-of-accounts.png)
![Step 2](./visual/screenshots/flows/accounting-add-account/02-add-account-drawer.png)
![Step 3](./visual/screenshots/flows/accounting-add-account/03-account-fields-filled.png)

### Accounting — Post journal (`flows/accounting-post-journal/`)

| Step | What you do |
|------|-------------|
| 1 | **Journal entries** tab |
| 2 | **+ Post journal** |
| 3 | Description, balanced debit/credit lines → **Post journal** |

![Step 1](./visual/screenshots/flows/accounting-post-journal/01-journals-list.png)
![Step 2](./visual/screenshots/flows/accounting-post-journal/02-journal-drawer-empty.png)
![Step 3](./visual/screenshots/flows/accounting-post-journal/03-journal-balanced.png)

### HR — Add employee (`flows/hr-add-employee/`)

| Step | What you do |
|------|-------------|
| 1 | **HR** employee list |
| 2 | **+ Add employee** |
| 3 | Name, designation, salary → **Create** |

![Step 1](./visual/screenshots/flows/hr-add-employee/01-employees-list.png)
![Step 2](./visual/screenshots/flows/hr-add-employee/02-add-employee-drawer.png)
![Step 3](./visual/screenshots/flows/hr-add-employee/03-fields-filled.png)

### HR — Attendance (`flows/hr-attendance/`)

| Step | What you do |
|------|-------------|
| 1 | **HR → Attendance** |
| 2 | **+ Record attendance** — employee → **Record** |

![Step 1](./visual/screenshots/flows/hr-attendance/01-attendance-tab.png)
![Step 2](./visual/screenshots/flows/hr-attendance/02-attendance-drawer.png)

### HR — Staff meal (`flows/hr-staff-meal/`)

| Step | What you do |
|------|-------------|
| 1 | **HR → Staff meals** |
| 2 | **+ Record meal** — employee, meal recipe, qty |

![Step 1](./visual/screenshots/flows/hr-staff-meal/01-staff-meals-tab.png)
![Step 2](./visual/screenshots/flows/hr-staff-meal/02-meal-drawer-filled.png)

### HR — Payroll (`flows/hr-payroll/`)

| Step | What you do |
|------|-------------|
| 1 | **HR → Payroll** |
| 2 | **Run payroll for current month** (confirm dialog) |

![Step 1](./visual/screenshots/flows/hr-payroll/01-payroll-tab.png)
![Step 2](./visual/screenshots/flows/hr-payroll/02-payroll-confirm-dialog.png)

### Settings — Branch & invite (`flows/settings-admin/`)

| Step | What you do |
|------|-------------|
| 1 | **Settings → Organization** |
| 2 | **+ Add branch** |
| 3 | Branch name & timezone |
| 4 | **Team & access** tab |
| 5 | **Invite by email** + role |

![Step 1](./visual/screenshots/flows/settings-admin/01-organization-tab.png)
![Step 2](./visual/screenshots/flows/settings-admin/02-add-branch-drawer.png)
![Step 3](./visual/screenshots/flows/settings-admin/03-branch-name-filled.png)
![Step 4](./visual/screenshots/flows/settings-admin/04-team-tab.png)
![Step 5](./visual/screenshots/flows/settings-admin/05-invite-email-filled.png)

### Settings — Inventory pool (`flows/settings-inventory-pool/`)

| Step | What you do |
|------|-------------|
| 1 | **Settings → Inventory pools** |
| 2 | **+ Add pool** |
| 3 | Code (slug), display name → **Create pool** |

![Step 1](./visual/screenshots/flows/settings-inventory-pool/01-pools-list.png)
![Step 2](./visual/screenshots/flows/settings-inventory-pool/02-add-pool-drawer.png)
![Step 3](./visual/screenshots/flows/settings-inventory-pool/03-pool-fields-filled.png)

### Reports — Export (`flows/reports-export/`)

| Step | What you do |
|------|-------------|
| 1 | **Reports** job list |
| 2 | Choose report type (e.g. **Profit & loss**), set dates → **Export CSV** |

![Step 1](./visual/screenshots/flows/reports-export/01-reports-default.png)
![Step 2](./visual/screenshots/flows/reports-export/02-pl-selected.png)

---

## Module gallery

Overview screenshots (full page) from `apps/web/e2e/visual-guide.spec.ts`. If images are missing, run `pnpm test:visual-guide`.

### Dashboard

Branch KPIs: occupancy, revenue signals, low-stock hints.

![Dashboard](./visual/screenshots/01-dashboard.png)

| | |
|--|--|
| **Route** | `/dashboard` |
| **E2E** | `dashboard.spec.ts` |
| **Deep dive** | [reporting-module.md](./reporting-module.md) |

---

### PMS — Reservations

Guests, reservations, status workflow (inquiry → confirmed → in-house → out). **Setup order:** room types → rooms → guests → inclusion recipes → guest packages → rate plans → reservations (see [step-by-step flows](#pms--recommended-setup-order)).

![PMS reservations](./visual/screenshots/02-pms-reservations.png)

| | |
|--|--|
| **Tabs** | Reservations, Rooms, Room types, Guests, Guest packages, Rates |
| **E2E** | `pms.spec.ts`, `pms-flow.spec.ts`, `visual-guide-flows-pms.spec.ts` |
| **Deep dive** | [pms-module.md](./pms-module.md) |

### PMS — Rooms

Housekeeping: vacant, occupied, dirty, maintenance.

![PMS rooms](./visual/screenshots/03-pms-rooms.png)

### PMS — Rates

Rate plans, rules, optional F&B package bundle per plan.

![PMS rates](./visual/screenshots/04-pms-rates.png)

| | |
|--|--|
| **E2E** | `rates.spec.ts` |

---

### POS

Categories, menu, open orders, payments.

![POS](./visual/screenshots/05-pos.png)

| | |
|--|--|
| **E2E** | `pos.spec.ts` |
| **Deep dive** | [pos-module.md](./pos-module.md) |

### Kitchen

Live tickets from submitted orders.

![Kitchen](./visual/screenshots/06-kitchen.png)

| | |
|--|--|
| **E2E** | `kitchen.spec.ts` |

---

### Inventory

Items, movements, weighted-average cost, recipes (BOM).

![Inventory](./visual/screenshots/07-inventory.png)

| | |
|--|--|
| **E2E** | `inventory.spec.ts` |
| **Deep dive** | [inventory-module.md](./inventory-module.md) |

### Procurement

Vendors and purchase orders; receive posts stock + AP journal (with real API).

![Procurement vendors](./visual/screenshots/08-procurement-vendors.png)

![Procurement POs](./visual/screenshots/09-procurement-orders.png)

| | |
|--|--|
| **E2E** | `procurement.spec.ts` |

---

### Accounting

Chart of accounts and journal entries (manual + auto-posted from PMS/POS/payroll/procurement).

![Accounting](./visual/screenshots/10-accounting.png)

| | |
|--|--|
| **E2E** | `accounting.spec.ts` |
| **Deep dive** | [accounting-module.md](./accounting-module.md), [accounting-rules.md](./accounting-rules.md) |

---

### HR

Employees, attendance, staff meals, payroll runs, payslip download.

![HR](./visual/screenshots/11-hr.png)

| | |
|--|--|
| **E2E** | `hr.spec.ts` |
| **Deep dive** | [hr-module.md](./hr-module.md) |

---

### Reports

Queue CSV exports (operational + financial: trial balance, P&L, balance sheet, GL).

![Reports](./visual/screenshots/12-reports.png)

| | |
|--|--|
| **E2E** | `reports.spec.ts`, `notifications.spec.ts` |
| **Deep dive** | [reporting-module.md](./reporting-module.md) |

---

### Settings

Organization, branches, inventory pools, team (invite + join code), audit log.

![Settings — organization](./visual/screenshots/13-settings-organization.png)

![Settings — team](./visual/screenshots/14-settings-team.png)

![Settings — audit](./visual/screenshots/15-settings-audit.png)

| | |
|--|--|
| **E2E** | `settings.spec.ts`, `audit.spec.ts` |
| **Deep dive** | [settings-module.md](./settings-module.md), [organization-onboarding.md](./organization-onboarding.md) |

---

## E2E index (by module)

| Module | Spec file | What it proves |
|--------|-----------|----------------|
| Auth | `smoke.spec.ts`, `auth.spec.ts` | Login redirect |
| Onboarding | `onboarding.spec.ts` | Join / create org |
| Tenant / RBAC | `tenant.spec.ts` | Route guards by role |
| Dashboard | `dashboard.spec.ts` | Stat cards |
| PMS | `pms.spec.ts`, `pms-flow.spec.ts` | CRUD + lifecycle |
| Rates | `rates.spec.ts` | Plans, quote, F&B bundle |
| POS | `pos.spec.ts` | Orders, pay |
| Kitchen | `kitchen.spec.ts` | Ticket flow |
| Inventory | `inventory.spec.ts` | Items, movements |
| Procurement | `procurement.spec.ts` | Vendor, PO, receive |
| Accounting | `accounting.spec.ts` | Accounts, journals |
| HR | `hr.spec.ts` | Employee, payroll |
| Reports | `reports.spec.ts` | Export jobs |
| Notifications | `notifications.spec.ts` | Bell, deep links |
| Settings | `settings.spec.ts` | Branches, team invite |
| Audit | `audit.spec.ts` | Audit log tab |
| **Visual tour** | `visual-guide.spec.ts`, `visual-guide-flows*.spec.ts` | PNGs for this guide + PDF (local only) |

All use `mockApiRoutes` unless you add a future `REAL_API=1` profile for staging captures.

---

## Real stack vs mocked tour

| | Mocked E2E / visual guide | Staging / production |
|--|-------------------------|----------------------|
| Data | Fixed helpers in `e2e/helpers/*-state.ts` | PostgreSQL + seed or live tenants |
| Auth | Mock token in `localStorage` | PropelAuth hosted login |
| GL side effects | Not exercised | Journals, payroll, receipts persist |

For **accountant-facing** validation, use [phase1-signoff.md](./phase1-signoff.md) smoke checklist on a deployed environment.

---

## Related

- [Phase 1 sign-off](./phase1-signoff.md)
- [App workflow guide](./app-workflow-guide.md)
- [ERP completeness roadmap](./erp-completeness-roadmap.md)
