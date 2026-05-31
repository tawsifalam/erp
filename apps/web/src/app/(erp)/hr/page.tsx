"use client";

import { useCallback, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Table,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import { BranchRequiredNotice } from "@/components/branch-required-notice";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePageHeader } from "@/components/module-page-header";
import {
  MoneyText,
  EmptyState,
  FormField,
  ListSkeleton,
  TableSkeleton,
} from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";
import { useAsync } from "@/lib/use-async";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";
import { useModuleTab } from "@/lib/use-module-tab";
import { formatDateTime } from "@/lib/format";
import { appToast } from "@/lib/app-toast";

type Employee = { id: string; name: string; designation: string; salary: string };
type PayrollRun = {
  id: string;
  status: string;
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
type AttendanceRecord = {
  id: string;
  type: string;
  recordedAt: string;
  employee: { name: string };
};
type InvItem = { id: string; name: string; unit: string };
type StaffMealRecipe = {
  id: string;
  name: string;
  lines: {
    inventoryItemId: string;
    quantity: string;
    inventoryItem: InvItem;
  }[];
};
type StaffMealRecord = {
  id: string;
  mealCount: number;
  createdAt: string;
  employee: { name: string };
  recipe: { name: string };
};

export default function HrPage() {
  const tenant = useTenantHeaders();
  const [tab, setTab] = useModuleTab("employees");
  const { ask, dialog } = useConfirmDialog();
  const [empForm, setEmpForm] = useState({ name: "", designation: "", salary: "" });
  const [clockEmployeeId, setClockEmployeeId] = useState("");
  const [clockType, setClockType] = useState<"CLOCK_IN" | "CLOCK_OUT">("CLOCK_IN");
  const [mealForm, setMealForm] = useState({
    employeeId: "",
    staffMealRecipeId: "",
    mealCount: "1",
    deductFromPayroll: false,
  });
  const [recipeForm, setRecipeForm] = useState({
    name: "",
    lines: [{ inventoryItemId: "", quantity: "" }],
  });

  const employeesQuery = useAsync(
    () => apiFetch<Employee[]>("/hr/employees", { tenant }),
    [tenant.organizationId],
  );

  const payrollQuery = useAsync(
    () => apiFetch<PayrollRun[]>("/payroll/runs", { tenant }),
    [tenant.organizationId],
  );

  const attendanceQuery = useAsync(
    () =>
      tenant.branchId
        ? apiFetch<AttendanceRecord[]>(
            `/hr/attendance?branchId=${tenant.branchId}`,
            { tenant },
          )
        : Promise.resolve([]),
    [tenant.organizationId, tenant.branchId],
  );

  const mealRecipesQuery = useAsync(
    () =>
      tenant.branchId
        ? apiFetch<StaffMealRecipe[]>(
            `/hr/staff-meal-recipes?branchId=${tenant.branchId}`,
            { tenant },
          )
        : Promise.resolve([]),
    [tenant.branchId, tenant.organizationId],
  );

  const staffMealsQuery = useAsync(
    () =>
      tenant.branchId
        ? apiFetch<StaffMealRecord[]>(`/hr/staff-meals?branchId=${tenant.branchId}`, { tenant })
        : Promise.resolve([]),
    [tenant.branchId, tenant.organizationId],
  );

  const inventoryQuery = useAsync(
    () =>
      tenant.branchId
        ? apiFetch<InvItem[]>(
            `/inventory/items?branchId=${tenant.branchId}&pool=staff`,
            { tenant },
          )
        : Promise.resolve([]),
    [tenant.branchId, tenant.organizationId],
  );

  const reloadAttendance = useCallback(() => attendanceQuery.reload(), [attendanceQuery]);

  const employees = employeesQuery.data ?? [];
  const payrollRuns = payrollQuery.data ?? [];
  const attendance = attendanceQuery.data ?? [];
  const mealRecipes = mealRecipesQuery.data ?? [];
  const staffMeals = staffMealsQuery.data ?? [];
  const inventoryItems = inventoryQuery.data ?? [];

  const handleAddEmployee = async () => {
    try {
      await apiFetch("/hr/employees", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          name: empForm.name,
          designation: empForm.designation,
          salary: Number(empForm.salary),
          branchId: tenant.branchId,
        }),
      });
      setEmpForm({ name: "", designation: "", salary: "" });
      employeesQuery.reload();
      appToast.success("Employee added");
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to add employee");
    }
  };

  const handleClock = async () => {
    if (!clockEmployeeId || !tenant.branchId) return;
    try {
      await apiFetch("/hr/attendance/clock", {
        method: "POST",
        tenant,
        body: JSON.stringify({ employeeId: clockEmployeeId, type: clockType }),
      });
      appToast.success(`${clockType === "CLOCK_IN" ? "Clocked in" : "Clocked out"} successfully`);
      reloadAttendance();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to record attendance");
    }
  };

  const handleSaveRecipe = async () => {
    if (!tenant.branchId) return;
    try {
      await apiFetch("/hr/staff-meal-recipes", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          name: recipeForm.name,
          lines: recipeForm.lines
            .filter((l) => l.inventoryItemId && Number(l.quantity) > 0)
            .map((l) => ({
              inventoryItemId: l.inventoryItemId,
              quantity: Number(l.quantity),
            })),
        }),
      });
      setRecipeForm({ name: "", lines: [{ inventoryItemId: "", quantity: "" }] });
      mealRecipesQuery.reload();
      appToast.success("Staff meal recipe saved");
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to save recipe");
    }
  };

  const handleStaffMeal = async () => {
    if (!tenant.branchId) return;
    try {
      await apiFetch("/hr/staff-meals", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          employeeId: mealForm.employeeId,
          staffMealRecipeId: mealForm.staffMealRecipeId,
          mealCount: Number(mealForm.mealCount),
          deductFromPayroll: mealForm.deductFromPayroll,
        }),
      });
      setMealForm({
        employeeId: "",
        staffMealRecipeId: "",
        mealCount: "1",
        deductFromPayroll: false,
      });
      staffMealsQuery.reload();
      appToast.success("Staff meal recorded (recipe ingredients deducted)");
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to record staff meal");
    }
  };

  const runPayroll = async () => {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const job = await apiFetch<{ id: string }>("/hr/payroll/runs", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          periodStart: start.toISOString(),
          periodEnd: now.toISOString(),
        }),
      });
      appToast.success(`Payroll run queued: ${job.id}`);
      payrollQuery.reload();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to queue payroll run");
    }
  };

  const confirmRunPayroll = () => {
    ask({
      title: "Run payroll for current month?",
      description:
        "This queues a payroll run from the 1st of this month through today. Existing runs for the same period are not duplicated.",
      confirmLabel: "Run payroll",
      onConfirm: runPayroll,
    });
  };

  return (
    <DashboardShell>
      {dialog}
      <ModulePageHeader />

      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)} mb={4}>
        <Tabs.List>
          <Tabs.Trigger value="employees">Employees</Tabs.Trigger>
          <Tabs.Trigger value="attendance">Attendance</Tabs.Trigger>
          <Tabs.Trigger value="meals">Staff meals</Tabs.Trigger>
          <Tabs.Trigger value="payroll">Payroll</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="employees" pt={4}>
          <Box bg="white" borderRadius="md" p={4} mb={4}>
            <Text fontWeight="semibold" mb={3}>
              Add employee
            </Text>
            <Flex gap={2} wrap="wrap">
              <FormField label="Name" required>
                <Input
                  size="sm"
                  w="180px"
                  placeholder="Name"
                  value={empForm.name}
                  onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                />
              </FormField>
              <FormField label="Designation">
                <Input
                  size="sm"
                  w="160px"
                  placeholder="Designation"
                  value={empForm.designation}
                  onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                />
              </FormField>
              <FormField label="Salary">
                <Input
                  size="sm"
                  w="120px"
                  type="number"
                  placeholder="Salary"
                  value={empForm.salary}
                  onChange={(e) => setEmpForm({ ...empForm, salary: e.target.value })}
                />
              </FormField>
              <Button size="sm" colorPalette="blue" alignSelf="flex-end" onClick={handleAddEmployee}>
                Add
              </Button>
            </Flex>
          </Box>
          <Box bg="white" borderRadius="md" p={4}>
            {employeesQuery.loading ? (
              <TableSkeleton rows={5} columns={3} />
            ) : (
              <>
                <Table.Root size="sm">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Name</Table.ColumnHeader>
                      <Table.ColumnHeader>Role</Table.ColumnHeader>
                      <Table.ColumnHeader>Salary</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {employees.map((e) => (
                      <Table.Row key={e.id}>
                        <Table.Cell>{e.name}</Table.Cell>
                        <Table.Cell>{e.designation}</Table.Cell>
                        <Table.Cell>
                          <MoneyText amount={Number(e.salary)} />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
                {employees.length === 0 && <EmptyState message="No employees yet." />}
              </>
            )}
          </Box>
        </Tabs.Content>

        <Tabs.Content value="attendance" pt={4}>
          {!tenant.branchId && <BranchRequiredNotice />}
          <Box bg="white" borderRadius="md" p={4} maxW="480px" mb={4}>
            <Stack gap={3}>
              <FormField label="Employee" required>
                <AppSelect
                  items={[
                    { value: "", label: "Select employee" },
                    ...employees.map((e) => ({ value: e.id, label: e.name })),
                  ]}
                  value={clockEmployeeId}
                  onValueChange={setClockEmployeeId}
                  placeholder="Select employee"
                />
              </FormField>
              <FormField label="Action">
                <AppSelect
                  items={[
                    { value: "CLOCK_IN", label: "Clock in" },
                    { value: "CLOCK_OUT", label: "Clock out" },
                  ]}
                  value={clockType}
                  onValueChange={(v) => setClockType(v as "CLOCK_IN" | "CLOCK_OUT")}
                />
              </FormField>
              <Button size="sm" colorPalette="green" w="fit-content" onClick={handleClock}>
                Record attendance
              </Button>
            </Stack>
          </Box>
          <Box bg="white" borderRadius="md" p={4}>
            <Text fontWeight="semibold" mb={2}>
              Recent attendance
            </Text>
            {attendanceQuery.loading ? (
              <ListSkeleton rows={5} />
            ) : (
              <>
                {attendance.length === 0 && (
                  <EmptyState message="No attendance records yet." />
                )}
                <Stack gap={1}>
                  {attendance.map((a) => (
                    <Flex key={a.id} justify="space-between" fontSize="sm" borderBottomWidth="1px" pb={1}>
                      <Text>
                        {a.employee.name} — {a.type.replace("_", " ")}
                      </Text>
                      <Text color="fg.muted">{formatDateTime(a.recordedAt)}</Text>
                    </Flex>
                  ))}
                </Stack>
              </>
            )}
          </Box>
        </Tabs.Content>

        <Tabs.Content value="meals" pt={4}>
          {!tenant.branchId && <BranchRequiredNotice />}

          <Box bg="white" borderRadius="md" p={4} mb={4}>
            <Text fontWeight="semibold" mb={2}>
              Meal recipes
            </Text>
            <Text fontSize="sm" color="fg.muted" mb={3}>
              Define each staff meal as a recipe (ingredients per 1 meal). Consumption auto-deducts inventory.
            </Text>
            {mealRecipesQuery.loading ? (
              <ListSkeleton rows={3} />
            ) : (
              mealRecipes.length > 0 && (
                <Stack gap={2} mb={4}>
                  {mealRecipes.map((r) => (
                    <Box key={r.id} borderWidth="1px" borderRadius="md" p={3}>
                      <Text fontWeight="medium">{r.name}</Text>
                      <Text fontSize="sm" color="fg.muted">
                        {r.lines
                          .map((l) => `${l.inventoryItem.name} ${l.quantity}${l.inventoryItem.unit}`)
                          .join(" · ")}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              )
            )}
            <Stack gap={2} maxW="640px">
              <FormField label="Recipe name" help="e.g. Staff Lunch">
                <Input
                  size="sm"
                  placeholder="Recipe name (e.g. Staff Lunch)"
                  value={recipeForm.name}
                  onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
                />
              </FormField>
              {recipeForm.lines.map((line, idx) => (
                <Flex key={idx} gap={2}>
                  <AppSelect
                    flex={1}
                    items={[
                      { value: "", label: "Ingredient" },
                      ...inventoryItems.map((i) => ({
                        value: i.id,
                        label: `${i.name} (${i.unit})`,
                      })),
                    ]}
                    value={line.inventoryItemId}
                    onValueChange={(v) => {
                      const lines = [...recipeForm.lines];
                      lines[idx] = { ...lines[idx], inventoryItemId: v };
                      setRecipeForm({ ...recipeForm, lines });
                    }}
                    placeholder="Ingredient"
                  />
                  <Input
                    size="sm"
                    w="120px"
                    type="number"
                    step="0.001"
                    placeholder="Qty / meal"
                    value={line.quantity}
                    onChange={(e) => {
                      const lines = [...recipeForm.lines];
                      lines[idx] = { ...lines[idx], quantity: e.target.value };
                      setRecipeForm({ ...recipeForm, lines });
                    }}
                  />
                </Flex>
              ))}
              <Flex gap={2}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setRecipeForm({
                      ...recipeForm,
                      lines: [...recipeForm.lines, { inventoryItemId: "", quantity: "" }],
                    })
                  }
                >
                  Add ingredient
                </Button>
                <Button size="sm" colorPalette="blue" onClick={handleSaveRecipe}>
                  Save recipe
                </Button>
              </Flex>
            </Stack>
          </Box>

          <Box bg="white" borderRadius="md" p={4} maxW="560px" mb={4}>
            <Text fontWeight="semibold" mb={2}>
              Record consumption
            </Text>
            <Text fontSize="sm" color="fg.muted" mb={3}>
              Select employee and meal recipe. Enter how many meals consumed.
            </Text>
            <Stack gap={3}>
              <FormField label="Employee" required>
                <AppSelect
                  items={[
                    { value: "", label: "Employee" },
                    ...employees.map((e) => ({ value: e.id, label: e.name })),
                  ]}
                  value={mealForm.employeeId}
                  onValueChange={(v) => setMealForm({ ...mealForm, employeeId: v })}
                  placeholder="Employee"
                />
              </FormField>
              <FormField label="Meal recipe" required>
                <AppSelect
                  items={[
                    { value: "", label: "Meal recipe" },
                    ...mealRecipes.map((r) => ({ value: r.id, label: r.name })),
                  ]}
                  value={mealForm.staffMealRecipeId}
                  onValueChange={(v) => setMealForm({ ...mealForm, staffMealRecipeId: v })}
                  placeholder="Meal recipe"
                />
              </FormField>
              <FormField label="Meals consumed">
                <Input
                  size="sm"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Meals consumed"
                  value={mealForm.mealCount}
                  onChange={(e) => setMealForm({ ...mealForm, mealCount: e.target.value })}
                />
              </FormField>
              <FormField label="Payroll deduction" help="Optionally deduct meal cost from next payroll.">
                <AppSelect
                  items={[
                    { value: "no", label: "Do not deduct from payroll" },
                    { value: "yes", label: "Deduct from next payroll" },
                  ]}
                  value={mealForm.deductFromPayroll ? "yes" : "no"}
                  onValueChange={(v) =>
                    setMealForm({ ...mealForm, deductFromPayroll: v === "yes" })
                  }
                />
              </FormField>
              <Button size="sm" colorPalette="green" w="fit-content" onClick={handleStaffMeal}>
                Record meal
              </Button>
            </Stack>
          </Box>

          <Box bg="white" borderRadius="md" p={4}>
            <Text fontWeight="semibold" mb={2}>
              Recent consumption
            </Text>
            {staffMealsQuery.loading ? (
              <ListSkeleton rows={5} />
            ) : (
              <>
                {staffMeals.length === 0 && (
                  <EmptyState message="No staff meals recorded yet." />
                )}
                <Stack gap={1}>
                  {staffMeals.map((m) => (
                    <Flex key={m.id} justify="space-between" fontSize="sm" borderBottomWidth="1px" pb={1}>
                      <Text>
                        {m.employee.name} — {m.mealCount}× {m.recipe.name}
                      </Text>
                      <Text color="fg.muted">{formatDateTime(m.createdAt)}</Text>
                    </Flex>
                  ))}
                </Stack>
              </>
            )}
          </Box>
        </Tabs.Content>

        <Tabs.Content value="payroll" pt={4}>
          <Text fontSize="sm" color="fg.muted" mb={3} maxW="560px">
            Run payroll to calculate gross pay, deductions, and net pay for all employees in the
            current calendar month. Results appear below once processing completes.
          </Text>
          <Button size="sm" mb={4} colorPalette="blue" onClick={confirmRunPayroll}>
            Run payroll for current month
          </Button>
          {payrollQuery.loading ? (
            <TableSkeleton rows={4} columns={4} />
          ) : (
            <>
              {payrollRuns.map((run) => (
                <Box key={run.id} bg="white" borderRadius="md" p={4} mb={4}>
                  <Flex justify="space-between" mb={2}>
                    <Text fontWeight="semibold">
                      {formatDateTime(run.periodStart)} — {formatDateTime(run.periodEnd)}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {run.status}
                    </Text>
                  </Flex>
                  <Table.Root size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Employee</Table.ColumnHeader>
                        <Table.ColumnHeader>Gross</Table.ColumnHeader>
                        <Table.ColumnHeader>Deductions</Table.ColumnHeader>
                        <Table.ColumnHeader>Net</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {run.lines.map((l, i) => (
                        <Table.Row key={i}>
                          <Table.Cell>{l.employee.name}</Table.Cell>
                          <Table.Cell>
                            <MoneyText amount={Number(l.grossPay)} />
                          </Table.Cell>
                          <Table.Cell>
                            <MoneyText amount={Number(l.deductions)} />
                          </Table.Cell>
                          <Table.Cell>
                            <MoneyText amount={Number(l.netPay)} />
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Box>
              ))}
              {payrollRuns.length === 0 && (
                <EmptyState message="No payroll runs yet." />
              )}
            </>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </DashboardShell>
  );
}
