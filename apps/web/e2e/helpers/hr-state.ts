import { recordAudit } from "./audit-state";
import { recordNotification } from "./notification-state";

type MockEmployee = {
  id: string;
  organizationId: string;
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
  organizationId: string;
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
  branchId: string;
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

const MOCK_ORG_A = "org-test-001";
const MOCK_BRANCH_A1 = "branch-test-001";
const MOCK_BRANCH_A2 = "branch-test-002";

const INITIAL_EMPLOYEES: MockEmployee[] = [
  {
    id: "emp_001",
    organizationId: MOCK_ORG_A,
    name: "Karim Hossain",
    designation: "Head Chef",
    salary: "45000",
    status: "ACTIVE",
    branchId: MOCK_BRANCH_A1,
  },
  {
    id: "emp_002",
    organizationId: MOCK_ORG_A,
    name: "Nasreen Begum",
    designation: "Front Desk",
    salary: "35000",
    status: "ACTIVE",
    branchId: MOCK_BRANCH_A2,
  },
];

const INITIAL_PAYROLL: MockPayrollRun[] = [
  {
    id: "pr_001",
    organizationId: MOCK_ORG_A,
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
    branchId: MOCK_BRANCH_A1,
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

const INITIAL_ATTENDANCE: MockAttendance[] = [
  {
    id: "att_001",
    employeeId: "emp_001",
    branchId: MOCK_BRANCH_A1,
    type: "CLOCK_IN",
    recordedAt: "2026-06-01T08:00:00Z",
    employee: { id: "emp_001", name: "Karim Hossain" },
  },
  {
    id: "att_a2_001",
    employeeId: "emp_002",
    branchId: MOCK_BRANCH_A2,
    type: "CLOCK_IN",
    recordedAt: "2026-06-01T09:00:00Z",
    employee: { id: "emp_002", name: "Nasreen Begum" },
  },
];

let employees = structuredClone(INITIAL_EMPLOYEES) as MockEmployee[];
let payrollRuns = structuredClone(INITIAL_PAYROLL) as MockPayrollRun[];
let staffMealRecipes = structuredClone(INITIAL_RECIPES) as MockStaffMealRecipe[];
let attendance = structuredClone(INITIAL_ATTENDANCE) as MockAttendance[];
const staffMeals: MockStaffMeal[] = [];

export function resetHrState() {
  employees = structuredClone(INITIAL_EMPLOYEES) as MockEmployee[];
  payrollRuns = structuredClone(INITIAL_PAYROLL) as MockPayrollRun[];
  staffMealRecipes = structuredClone(INITIAL_RECIPES) as MockStaffMealRecipe[];
  attendance = structuredClone(INITIAL_ATTENDANCE) as MockAttendance[];
  staffMeals.length = 0;
}

export function getHrAttendance(branchId?: string) {
  const rows = attendance.map((a) => ({ ...a }));
  if (!branchId) return rows;
  return rows.filter((a) => a.branchId === branchId);
}

export function getHrEmployees(organizationId?: string) {
  const rows = employees.map((e) => ({ ...e }));
  if (!organizationId) return rows;
  return rows.filter((e) => e.organizationId === organizationId);
}

function getStaffMealRecipes(branchId?: string) {
  const rows = staffMealRecipes.map((r) => ({ ...r, lines: r.lines.map((l) => ({ ...l })) }));
  if (!branchId) return rows;
  return rows.filter((r) => r.branchId === branchId);
}

function findEmployeeInOrg(id: string, organizationId?: string) {
  const emp = employees.find((e) => e.id === id);
  if (!emp) return null;
  if (organizationId && emp.organizationId !== organizationId) return null;
  return emp;
}

export function getPayrollRuns(organizationId?: string) {
  const rows = payrollRuns.map((r) => ({ ...r }));
  if (!organizationId) return rows;
  return rows.filter((r) => r.organizationId === organizationId);
}

export function findPayrollRunInOrg(runId: string, organizationId?: string) {
  const run = payrollRuns.find((r) => r.id === runId);
  if (!run) return null;
  if (organizationId && run.organizationId !== organizationId) return null;
  return run;
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
  organizationId?: string,
  branchId?: string,
): unknown {
  if (url.match(/\/hr\/employees\/[^/?]+/) && method === "PATCH") {
    const idMatch = url.match(/\/employees\/([^/?]+)/);
    const id = idMatch?.[1];
    const emp = id ? findEmployeeInOrg(id, organizationId) : null;
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
    if (method === "GET") return getHrEmployees(organizationId);
    if (method === "POST") {
      const emp: MockEmployee = {
        id: "emp_new",
        organizationId: organizationId ?? MOCK_ORG_A,
        name: String(body?.name ?? "New Employee"),
        designation: String(body?.designation ?? "Staff"),
        salary: String(body?.salary ?? "0"),
        status: "ACTIVE",
        branchId: body?.branchId ? String(body.branchId) : branchId,
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
    const emp = findEmployeeInOrg(employeeId, organizationId);
    if (!emp) return { status: 404, message: "Employee not found" };
    if (emp.status === "TERMINATED") {
      return { status: 400, message: "Employee is terminated" };
    }
    if (emp.branchId && branchId && emp.branchId !== branchId) {
      return { status: 403, message: "Employee does not belong to this branch" };
    }
    const record: MockAttendance = {
      id: `att_${attendance.length + 1}`,
      employeeId,
      branchId: branchId ?? emp.branchId ?? MOCK_BRANCH_A1,
      type: String(body?.type ?? "CLOCK_IN"),
      recordedAt: new Date().toISOString(),
      employee: { id: emp.id, name: emp.name },
    };
    attendance.unshift(record);
    return record;
  }

  if (url.includes("/hr/attendance") && method === "GET") {
    return getHrAttendance(branchId);
  }

  if (url.includes("/hr/staff-meal-recipes")) {
    if (method === "GET") return getStaffMealRecipes(branchId);
    if (method === "POST") {
      const lines = (body?.lines as { inventoryItemId: string; quantity: number }[]) ?? [];
      const recipe: MockStaffMealRecipe = {
        id: `smr_${staffMealRecipes.length + 1}`,
        branchId: branchId ?? MOCK_BRANCH_A1,
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
      const emp = findEmployeeInOrg(employeeId, organizationId);
      const recipe = findRecipe(recipeId);
      if (!emp || !recipe) return { status: 404, message: "Not found" };
      if (branchId && recipe.branchId !== branchId) {
        return { status: 404, message: "Staff meal recipe not found" };
      }
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
      organizationId: organizationId ?? MOCK_ORG_A,
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

  const payrollById = url.match(/\/payroll\/runs\/([^/?]+)(?:\/(payslip))?\/?$/);
  if (method === "GET" && payrollById) {
    const runId = payrollById[1]!;
    const isPayslip = payrollById[2] === "payslip";
    const run = findPayrollRunInOrg(runId, organizationId);
    if (!run) {
      return {
        status: 404,
        message: isPayslip ? "Payslip not available" : "Payroll run not found",
      };
    }
    if (isPayslip) {
      if (!run.payslipKey) return { status: 404, message: "Payslip not available" };
      return { payslipPdf: true };
    }
    return { ...run };
  }

  if (url.match(/\/payroll\/runs\/?(?:\?|$)/) && method === "GET") {
    return getPayrollRuns(organizationId);
  }

  return {};
}
