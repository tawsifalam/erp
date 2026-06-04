import { recordAudit } from "./audit-state";
import { recordNotification } from "./notification-state";

type MockEmployee = {
  id: string;
  name: string;
  designation: string;
  salary: string;
  status: string;
  branchId?: string;
  terminatedAt?: string | null;
};

type MockAttendance = {
  id: string;
  employeeId: string;
  branchId: string;
  type: string;
  recordedAt: string;
  employee: { id: string; name: string };
};

type MockPayrollRun = {
  id: string;
  status: string;
  payslipKey?: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  lines: {
    employee: { name: string };
    grossPay: string;
    deductions: string;
    netPay: string;
  }[];
};

type MockStaffMealRecipe = {
  id: string;
  name: string;
  lines: {
    inventoryItemId: string;
    quantity: number;
    inventoryItem: { id: string; name: string; unit: string };
  }[];
};

type MockStaffMeal = {
  id: string;
  employeeId: string;
  staffMealRecipeId: string;
  mealCount: number;
  deductFromPayroll: boolean;
  createdAt: string;
  employee: { name: string };
  recipe: { name: string };
};

const INITIAL_EMPLOYEES: MockEmployee[] = [
  { id: "emp_001", name: "Karim Hossain", designation: "Head Chef", salary: "45000", status: "ACTIVE" },
  { id: "emp_002", name: "Nasreen Begum", designation: "Front Desk", salary: "35000", status: "ACTIVE" },
];

const INITIAL_PAYROLL: MockPayrollRun[] = [
  {
    id: "pr_001",
    status: "COMPLETED",
    payslipKey: "payroll/pr_001.pdf",
    periodStart: "2026-05-01T00:00:00Z",
    periodEnd: "2026-05-31T00:00:00Z",
    createdAt: "2026-05-28T12:00:00Z",
    lines: [
      {
        employee: { name: "Karim Hossain" },
        grossPay: "45000",
        deductions: "0",
        netPay: "45000",
      },
    ],
  },
];

const INITIAL_RECIPES: MockStaffMealRecipe[] = [
  {
    id: "smr_001",
    name: "Staff Lunch",
    lines: [
      {
        inventoryItemId: "inv-staff-001",
        quantity: 0.3,
        inventoryItem: { id: "inv-staff-001", name: "Staff Lunch Rice", unit: "kg" },
      },
    ],
  },
];

let employees = structuredClone(INITIAL_EMPLOYEES) as MockEmployee[];
let payrollRuns = structuredClone(INITIAL_PAYROLL) as MockPayrollRun[];
let staffMealRecipes = structuredClone(INITIAL_RECIPES) as MockStaffMealRecipe[];
const attendance: MockAttendance[] = [];
const staffMeals: MockStaffMeal[] = [];

export function resetHrState() {
  employees = structuredClone(INITIAL_EMPLOYEES) as MockEmployee[];
  payrollRuns = structuredClone(INITIAL_PAYROLL) as MockPayrollRun[];
  staffMealRecipes = structuredClone(INITIAL_RECIPES) as MockStaffMealRecipe[];
  attendance.length = 0;
  staffMeals.length = 0;
}

export function getHrEmployees() {
  return employees.map((e) => ({ ...e }));
}

export function getPayrollRuns() {
  return payrollRuns.map((r) => ({ ...r }));
}

function findEmployee(id: string) {
  return employees.find((e) => e.id === id);
}

function findRecipe(id: string) {
  return staffMealRecipes.find((r) => r.id === id);
}

export function handleHrMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  if (url.match(/\/hr\/employees\/[^/?]+/) && method === "PATCH") {
    const idMatch = url.match(/\/employees\/([^/?]+)/);
    const id = idMatch?.[1];
    const emp = id ? findEmployee(id) : undefined;
    if (!emp) return { status: 404, message: "Employee not found" };
    if (body?.name) emp.name = String(body.name);
    if (body?.designation) emp.designation = String(body.designation);
    if (body?.salary !== undefined) emp.salary = String(body.salary);
    if (body?.status === "TERMINATED") {
      emp.status = "TERMINATED";
      emp.terminatedAt = new Date().toISOString();
    }
    if (body?.status === "ACTIVE") {
      emp.status = "ACTIVE";
      emp.terminatedAt = null;
    }
    recordAudit({
      action: "UPDATE",
      entityType: "employee",
      entityId: id,
      metadata: { status: emp.status, name: emp.name },
    });
    return { ...emp };
  }

  if (url.includes("/hr/employees")) {
    if (method === "GET") return getHrEmployees();
    if (method === "POST") {
      const emp: MockEmployee = {
        id: "emp_new",
        name: String(body?.name ?? "New Employee"),
        designation: String(body?.designation ?? "Staff"),
        salary: String(body?.salary ?? "0"),
        status: "ACTIVE",
        branchId: body?.branchId ? String(body.branchId) : undefined,
      };
      employees.push(emp);
      recordAudit({
        action: "CREATE",
        entityType: "employee",
        entityId: emp.id,
        metadata: { name: emp.name },
      });
      return emp;
    }
  }

  if (url.includes("/hr/attendance/clock") && method === "POST") {
    const employeeId = String(body?.employeeId ?? "");
    const emp = findEmployee(employeeId);
    if (!emp) return { status: 404, message: "Employee not found" };
    if (emp.status === "TERMINATED") {
      return { status: 400, message: "Employee is terminated" };
    }
    const record: MockAttendance = {
      id: `att_${attendance.length + 1}`,
      employeeId,
      branchId: "branch-test-001",
      type: String(body?.type ?? "CLOCK_IN"),
      recordedAt: new Date().toISOString(),
      employee: { id: emp.id, name: emp.name },
    };
    attendance.unshift(record);
    return record;
  }

  if (url.includes("/hr/attendance") && method === "GET") {
    return attendance.map((a) => ({ ...a }));
  }

  if (url.includes("/hr/staff-meal-recipes")) {
    if (method === "GET") return staffMealRecipes.map((r) => ({ ...r }));
    if (method === "POST") {
      const lines = (body?.lines as { inventoryItemId: string; quantity: number }[]) ?? [];
      const recipe: MockStaffMealRecipe = {
        id: `smr_${staffMealRecipes.length + 1}`,
        name: String(body?.name ?? "Meal"),
        lines: lines.map((l) => ({
          inventoryItemId: l.inventoryItemId,
          quantity: l.quantity,
          inventoryItem: {
            id: l.inventoryItemId,
            name: "Ingredient",
            unit: "kg",
          },
        })),
      };
      staffMealRecipes.push(recipe);
      return recipe;
    }
  }

  if (url.includes("/hr/staff-meals")) {
    if (method === "GET") return staffMeals.map((m) => ({ ...m }));
    if (method === "POST") {
      const employeeId = String(body?.employeeId ?? "");
      const recipeId = String(body?.staffMealRecipeId ?? "");
      const emp = findEmployee(employeeId);
      const recipe = findRecipe(recipeId);
      if (!emp || !recipe) return { status: 404, message: "Not found" };
      const meal: MockStaffMeal = {
        id: `sm_${staffMeals.length + 1}`,
        employeeId,
        staffMealRecipeId: recipeId,
        mealCount: Number(body?.mealCount ?? 1),
        deductFromPayroll: Boolean(body?.deductFromPayroll),
        createdAt: new Date().toISOString(),
        employee: { name: emp.name },
        recipe: { name: recipe.name },
      };
      staffMeals.unshift(meal);
      return meal;
    }
  }

  if (url.includes("/hr/payroll/runs") && method === "POST") {
    const run: MockPayrollRun = {
      id: `pr_${payrollRuns.length + 1}`,
      status: "PENDING",
      periodStart: String(body?.periodStart ?? new Date().toISOString()),
      periodEnd: String(body?.periodEnd ?? new Date().toISOString()),
      createdAt: new Date().toISOString(),
      lines: [],
    };
    payrollRuns.unshift(run);
    recordNotification({
      type: "PAYROLL_COMPLETED",
      title: "Payroll completed",
      body: "Payroll run has been queued and will notify when complete.",
      link: "/hr",
    });
    return run;
  }

  if (url.includes("/payroll/runs") && method === "GET") {
    return getPayrollRuns();
  }

  return {};
}
