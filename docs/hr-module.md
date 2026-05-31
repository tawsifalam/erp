# HR module reference

Organization-scoped **employees**, branch-scoped **attendance** and **staff meals**, and async **payroll runs** with staff-meal payroll deductions.

## Scope and tenancy

| Entity | Scoped by | Notes |
|--------|-----------|-------|
| Employees | Organization | Optional `branchId` link |
| Attendance | Branch | Clock in/out per branch |
| Staff meal recipes | Branch | Ingredients must be **staff pool** items |
| Staff meal consumption | Branch | Meal count per employee; auto-deducts staff pool stock |
| Payroll runs | Organization | BullMQ worker processes **active** org employees |

All HR routes require `Authorization` and `X-Organization-Id`. Attendance, staff meals, and clock require `X-Branch-Id`.

IDs use prefixes from seed/runtime: `emp_`, `att_`, `smr_`, `sml_`, `sm_`, `pr_`, `pl_`.

## Web UI (`/hr`)

Select **organization** and **branch** in the header (branch required for attendance and staff meals).

| Tab | Features |
|-----|----------|
| **Employees** | List staff; **add**, **edit** (inline), **terminate**, and **reactivate** employees |
| **Attendance** | Clock in/out for selected employee; **recent attendance** list for current branch |
| **Staff meals** | Define **meal recipes** (ingredients per meal); **record consumption** (employee + recipe + meal count); recent consumption list; optional payroll deduction |
| **Payroll** | **Run payroll** for current month; list runs with gross / deductions / net per employee |

## Staff meal flow

Staff meals work like POS recipes (BOM), but HR tracks **how many meals** each employee consumed.

### 1. Define meal recipes

Each recipe lists inventory ingredients required for **one meal** (e.g. Staff Lunch = 0.3 kg rice + 0.15 kg chicken).

```bash
curl -s -X POST "$BASE/hr/staff-meal-recipes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Staff Lunch",
    "lines": [
      { "inventoryItemId": "<rice-id>", "quantity": 0.3 },
      { "inventoryItemId": "<chicken-id>", "quantity": 0.15 }
    ]
  }' | jq
```

List recipes: `GET /hr/staff-meal-recipes?branchId=$BRANCH_ID`

### 2. Record consumption

When staff eat, record **meal count** (not raw ingredient quantities):

```bash
curl -s -X POST "$BASE/hr/staff-meals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "<emp-id>",
    "staffMealRecipeId": "<recipe-id>",
    "mealCount": 1,
    "deductFromPayroll": true
  }' | jq
```

**What happens:**

1. Validates employee and recipe for the branch
2. For each recipe line: creates `STAFF_MEAL` OUT movement with `quantity = line.quantity × mealCount`
3. Creates `StaffMeal` row with `mealCount` and `unitCostPerMeal` (snapshot for payroll)
4. If `deductFromPayroll: true`, `mealCount × unitCostPerMeal` is deducted on next payroll run

List consumption: `GET /hr/staff-meals?branchId=$BRANCH_ID`

**Payroll deduction formula (phase 1 placeholder):**

```
unitCostPerMeal = SUM(recipe line qty × STAFF_MEAL_UNIT_COST)   // STAFF_MEAL_UNIT_COST = 1
deduction = SUM(mealCount × unitCostPerMeal) for pending meals
netPay = grossPay − min(deductions, grossPay)
```

## Payroll async flow

```
POST /hr/payroll/runs
  → Create PayrollRun (PENDING)
  → Emit payroll.run_requested
  → PayrollListener → BullMQ "payroll" queue
  → PayrollProcessor
      → For each **active** employee: gross = salary, deduct pending staff meals
      → Create PayrollLine rows
      → Mark staff meals payrollDeducted
      → Upload placeholder artifact to storage
      → PayrollRun → COMPLETED
```

List runs: `GET /payroll/runs`.

## Validation (phase 1)

| Action | Rules |
|--------|-------|
| Create employee | Non-empty name and designation; salary ≥ 0; status defaults to `ACTIVE` |
| Update employee | Same field rules as create; optional `status` (`ACTIVE` / `TERMINATED`) |
| Terminate employee | `PATCH` with `status: TERMINATED`; sets `terminatedAt` |
| Reactivate employee | `PATCH` with `status: ACTIVE`; clears `terminatedAt` |
| Clock attendance | Employee must be **active** in org; branch required |
| Staff meal recipe | Name + at least one line; items must belong to branch |
| Staff meal consumption | `mealCount` positive integer; employee must be **active**; recipe in branch |
| Payroll run | `periodStart` < `periodEnd` |

## API reference

Base: `$BASE` = `http://localhost:3001/api`

### Employees

```bash
curl -s "$BASE/hr/employees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq

curl -s -X POST "$BASE/hr/employees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Hire","designation":"Trainee","salary":12000,"branchId":"<branch-id>"}' | jq

curl -s -X PATCH "$BASE/hr/employees/$EMP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Karim Hossain","designation":"Head Chef","salary":48000}' | jq

curl -s -X PATCH "$BASE/hr/employees/$EMP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"TERMINATED"}' | jq
```

**Employee status:** `ACTIVE` (default) or `TERMINATED`. Terminated employees remain in the list for history but are excluded from payroll runs, attendance clock-in, and staff meal recording. Reactivate with `{"status":"ACTIVE"}`.

### Attendance

```bash
curl -s "$BASE/hr/attendance?branchId=$BRANCH_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" | jq

curl -s -X POST "$BASE/hr/attendance/clock" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "X-Branch-Id: $BRANCH_ID" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"<emp-id>","type":"CLOCK_IN"}' | jq
```

**Types:** `CLOCK_IN`, `CLOCK_OUT`

### Staff meal recipes & consumption

See [Staff meal flow](#staff-meal-flow) above for curl examples.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hr/staff-meal-recipes` | List recipes for branch |
| POST | `/hr/staff-meal-recipes` | Create recipe |
| PUT | `/hr/staff-meal-recipes/:id` | Update recipe lines |
| GET | `/hr/staff-meals` | List consumption records |
| POST | `/hr/staff-meals` | Record meals consumed |

### Payroll

```bash
curl -s -X POST "$BASE/hr/payroll/runs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"periodStart":"2026-05-01","periodEnd":"2026-05-31"}' | jq

curl -s "$BASE/payroll/runs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG_ID" | jq
```

## Permissions

| Permission | Used for |
|------------|----------|
| `HR_READ` | List employees, attendance, recipes, consumption, payroll runs |
| `HR_WRITE` | Create employee, clock, recipes, record consumption, request payroll |

## Phase 2 (deferred)

- Payroll → accounting journals (salary expense / payable)
- Payslip PDF generation (placeholder `.txt` upload today)
- Employee edit/delete, attendance reports, leave management

## Testing

```bash
pnpm --filter @erp/api test -- "hr|payroll"
pnpm --filter @erp/web test:e2e hr
```

E2E uses stateful mocks in `apps/web/e2e/helpers/hr-state.ts` (employees, attendance, staff meals, payroll POST).

See also [app-workflow-guide.md §6](./app-workflow-guide.md#6-hr--payroll) for step-by-step curl walkthrough.
