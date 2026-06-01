"use client";

import { useCallback, useEffect, useState } from "react";
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
import { FormDialog } from "@/components/form-dialog";
import { FormDrawer } from "@/components/form-drawer";
import { FormSection } from "@/components/form-section";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePageHeader } from "@/components/module-page-header";
import {
  MoneyText,
  EmptyState,
  FormField,
  ContentCard,
  ListSkeleton,
  TableSkeleton,
  TableScrollArea,
  StatusBadge,
} from "@erp/ui";
import { ScrollableTabsList } from "@/components/scrollable-tabs-list";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";
import { useAsync } from "@/lib/use-async";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";
import { useModuleTab } from "@/lib/use-module-tab";
import { formatDateTime } from "@/lib/format";
import { appToast } from "@/lib/app-toast";

type Employee = {
  id: string;
  name: string;
  designation: string;
  salary: string;
  status: string;
  terminatedAt?: string | null;
};
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

const emptyEmpForm = () => ({ name: "", designation: "", salary: "" });

const emptyRecipeForm = () => ({
  name: "",
  lines: [{ inventoryItemId: "", quantity: "" }],
});

const emptyMealForm = () => ({
  employeeId: "",
  staffMealRecipeId: "",
  mealCount: "1",
  deductFromPayroll: false,
});

export default function HrPage() {
  const tenant = useTenantHeaders();
  const [tab, setTab] = useModuleTab("employees");
  const { ask, dialog } = useConfirmDialog();

  const [empDrawer, setEmpDrawer] = useState<"create" | "edit" | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [empForm, setEmpForm] = useState(emptyEmpForm());

  const [clockOpen, setClockOpen] = useState(false);
  const [clockEmployeeId, setClockEmployeeId] = useState("");
  const [clockType, setClockType] = useState<"CLOCK_IN" | "CLOCK_OUT">("CLOCK_IN");

  const [recipeDrawerOpen, setRecipeDrawerOpen] = useState(false);
  const [recipeForm, setRecipeForm] = useState(emptyRecipeForm);

  const [mealDrawerOpen, setMealDrawerOpen] = useState(false);
  const [mealForm, setMealForm] = useState(emptyMealForm());

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
    [tenant.branchId, tenant.organizationId],
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
  const activeEmployees = employees.filter((e) => e.status === "ACTIVE");
  const payrollRuns = payrollQuery.data ?? [];
  const attendance = attendanceQuery.data ?? [];
  const mealRecipes = mealRecipesQuery.data ?? [];
  const staffMeals = staffMealsQuery.data ?? [];
  const inventoryItems = inventoryQuery.data ?? [];

  const openCreateEmployee = () => {
    setEditingEmployeeId(null);
    setEmpForm(emptyEmpForm());
    setEmpDrawer("create");
  };

  const openEditEmployee = (e: Employee) => {
    setEditingEmployeeId(e.id);
    setEmpForm({
      name: e.name,
      designation: e.designation,
      salary: String(e.salary),
    });
    setEmpDrawer("edit");
  };

  const closeEmpDrawer = () => {
    setEmpDrawer(null);
    setEditingEmployeeId(null);
    setEmpForm(emptyEmpForm());
  };

  const handleSaveEmployee = async () => {
    if (!empForm.name.trim()) return;
    try {
      if (empDrawer === "create") {
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
        appToast.success("Employee added");
      } else if (editingEmployeeId) {
        await apiFetch(`/hr/employees/${editingEmployeeId}`, {
          method: "PATCH",
          tenant,
          body: JSON.stringify({
            name: empForm.name,
            designation: empForm.designation,
            salary: Number(empForm.salary),
          }),
        });
        appToast.success("Employee updated");
      }
      closeEmpDrawer();
      employeesQuery.reload();
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : "Failed to save employee");
    }
  };

  const updateEmployee = async (
    id: string,
    data: { status?: string },
  ) => {
    try {
      await apiFetch(`/hr/employees/${id}`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify(data),
      });
      employeesQuery.reload();
      appToast.success(
        data.status === "TERMINATED" ? "Employee terminated" : "Employee reactivated",
      );
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : "Failed to update employee");
    }
  };

  const confirmTerminate = (employee: Employee) => {
    ask({
      title: `Terminate ${employee.name}?`,
      description:
        "They will be removed from payroll, attendance, and meal recording. Past payroll and attendance history is preserved.",
      confirmLabel: "Terminate",
      onConfirm: () => updateEmployee(employee.id, { status: "TERMINATED" }),
    });
  };

  const closeClock = () => {
    setClockOpen(false);
    setClockEmployeeId("");
    setClockType("CLOCK_IN");
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
      closeClock();
      reloadAttendance();
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : "Failed to record attendance");
    }
  };

  const closeRecipeDrawer = () => {
    setRecipeDrawerOpen(false);
    setRecipeForm(emptyRecipeForm());
  };

  const handleSaveRecipe = async () => {
    if (!tenant.branchId || !recipeForm.name.trim()) return;
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
      closeRecipeDrawer();
      mealRecipesQuery.reload();
      appToast.success("Staff meal recipe saved");
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : "Failed to save recipe");
    }
  };

  const closeMealDrawer = () => {
    setMealDrawerOpen(false);
    setMealForm(emptyMealForm());
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
      closeMealDrawer();
      staffMealsQuery.reload();
      appToast.success("Staff meal recorded (recipe ingredients deducted)");
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : "Failed to record staff meal");
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
    } catch (err) {
      appToast.error(err instanceof Error ? err.message : "Failed to queue payroll run");
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
        <ScrollableTabsList>
          <Tabs.List>
            <Tabs.Trigger value="employees">Employees</Tabs.Trigger>
            <Tabs.Trigger value="attendance">Attendance</Tabs.Trigger>
            <Tabs.Trigger value="meals">Staff meals</Tabs.Trigger>
            <Tabs.Trigger value="payroll">Payroll</Tabs.Trigger>
          </Tabs.List>
        </ScrollableTabsList>

        <Tabs.Content value="employees" pt={4}>
          <Flex gap={2} mb={4} wrap="wrap">
            <Button size="sm" onClick={() => employeesQuery.reload()}>
              Refresh
            </Button>
            <Button
              size="sm"
              colorPalette="blue"
              w={{ base: "full", sm: "auto" }}
              onClick={openCreateEmployee}
            >
              + Add employee
            </Button>
          </Flex>
          <ContentCard p={0} overflow="hidden">
            {employeesQuery.loading ? (
              <Box p={4}>
                <TableSkeleton rows={5} columns={5} />
              </Box>
            ) : (
              <>
                <TableScrollArea>
                  <Table.Root size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Name</Table.ColumnHeader>
                        <Table.ColumnHeader display={{ base: "none", sm: "table-cell" }}>
                          Designation
                        </Table.ColumnHeader>
                        <Table.ColumnHeader>Salary</Table.ColumnHeader>
                        <Table.ColumnHeader>Status</Table.ColumnHeader>
                        <Table.ColumnHeader>Actions</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {employees.map((e) => (
                        <Table.Row key={e.id} opacity={e.status === "TERMINATED" ? 0.75 : 1}>
                          <Table.Cell fontWeight="medium">{e.name}</Table.Cell>
                          <Table.Cell display={{ base: "none", sm: "table-cell" }}>
                            {e.designation}
                          </Table.Cell>
                          <Table.Cell>
                            <MoneyText amount={Number(e.salary)} />
                          </Table.Cell>
                          <Table.Cell>
                            <StatusBadge status={e.status ?? "ACTIVE"} />
                          </Table.Cell>
                          <Table.Cell>
                            <Flex gap={1} wrap="wrap">
                              <Button size="xs" variant="outline" onClick={() => openEditEmployee(e)}>
                                Edit
                              </Button>
                              {e.status === "TERMINATED" ? (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  colorPalette="green"
                                  onClick={() => updateEmployee(e.id, { status: "ACTIVE" })}
                                >
                                  Reactivate
                                </Button>
                              ) : (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  colorPalette="red"
                                  onClick={() => confirmTerminate(e)}
                                >
                                  Terminate
                                </Button>
                              )}
                            </Flex>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </TableScrollArea>
                {employees.length === 0 && (
                  <Box p={4}>
                    <EmptyState
                      title="No employees yet"
                      description="Add staff to track attendance, meals, and payroll."
                    />
                  </Box>
                )}
              </>
            )}
          </ContentCard>
        </Tabs.Content>

        <Tabs.Content value="attendance" pt={4}>
          {!tenant.branchId && <BranchRequiredNotice />}
          {tenant.branchId && (
            <>
              <Flex gap={2} mb={4} wrap="wrap">
                <Button size="sm" onClick={reloadAttendance}>
                  Refresh
                </Button>
                <Button
                  size="sm"
                  colorPalette="blue"
                  w={{ base: "full", sm: "auto" }}
                  onClick={() => setClockOpen(true)}
                  disabled={activeEmployees.length === 0}
                >
                  + Record attendance
                </Button>
              </Flex>
              <ContentCard>
                <Text fontWeight="semibold" mb={2}>
                  Recent attendance
                </Text>
                {attendanceQuery.loading ? (
                  <ListSkeleton rows={5} />
                ) : attendance.length === 0 ? (
                  <EmptyState
                    title="No attendance records yet"
                    description="Record clock-in and clock-out for active employees."
                  />
                ) : (
                  <Stack gap={1}>
                    {attendance.map((a) => (
                      <Flex
                        key={a.id}
                        justify="space-between"
                        fontSize="sm"
                        borderBottomWidth="1px"
                        pb={1}
                      >
                        <Text>
                          {a.employee.name} — {a.type.replace("_", " ")}
                        </Text>
                        <Text color="fg.muted">{formatDateTime(a.recordedAt)}</Text>
                      </Flex>
                    ))}
                  </Stack>
                )}
              </ContentCard>
            </>
          )}
        </Tabs.Content>

        <Tabs.Content value="meals" pt={4}>
          {!tenant.branchId && <BranchRequiredNotice />}
          {tenant.branchId && (
            <>
              <Text fontSize="sm" color="fg.muted" mb={4}>
                Define meal recipes (ingredients per meal), then record consumption. Inventory
                deducts from the staff pool automatically.
              </Text>
              <Flex gap={2} mb={4} wrap="wrap">
                <Button size="sm" onClick={() => mealRecipesQuery.reload()}>
                  Refresh
                </Button>
                <Button
                  size="sm"
                  colorPalette="blue"
                  w={{ base: "full", sm: "auto" }}
                  onClick={() => setRecipeDrawerOpen(true)}
                >
                  + New recipe
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  w={{ base: "full", sm: "auto" }}
                  onClick={() => setMealDrawerOpen(true)}
                  disabled={mealRecipes.length === 0 || activeEmployees.length === 0}
                >
                  + Record meal
                </Button>
              </Flex>

              <ContentCard mb={4} p={0} overflow="hidden">
                <Box px={4} pt={4} pb={2}>
                  <Text fontWeight="semibold">Meal recipes</Text>
                </Box>
                {mealRecipesQuery.loading ? (
                  <Box p={4}>
                    <ListSkeleton rows={3} />
                  </Box>
                ) : mealRecipes.length === 0 ? (
                  <Box p={4}>
                    <EmptyState
                      title="No meal recipes"
                      description="Create a recipe before recording staff meals."
                    />
                  </Box>
                ) : (
                  <TableScrollArea>
                    <Table.Root size="sm">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Name</Table.ColumnHeader>
                          <Table.ColumnHeader>Ingredients</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {mealRecipes.map((r) => (
                          <Table.Row key={r.id}>
                            <Table.Cell fontWeight="medium">{r.name}</Table.Cell>
                            <Table.Cell fontSize="sm" color="fg.muted">
                              {r.lines
                                .map(
                                  (l) =>
                                    `${l.inventoryItem.name} ${l.quantity}${l.inventoryItem.unit}`,
                                )
                                .join(" · ")}
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </TableScrollArea>
                )}
              </ContentCard>

              <ContentCard>
                <Text fontWeight="semibold" mb={2}>
                  Recent consumption
                </Text>
                {staffMealsQuery.loading ? (
                  <ListSkeleton rows={5} />
                ) : staffMeals.length === 0 ? (
                  <EmptyState
                    title="No staff meals recorded yet"
                    description="Record consumption when staff eat."
                  />
                ) : (
                  <Stack gap={1}>
                    {staffMeals.map((m) => (
                      <Flex
                        key={m.id}
                        justify="space-between"
                        fontSize="sm"
                        borderBottomWidth="1px"
                        pb={1}
                      >
                        <Text>
                          {m.employee.name} — {m.mealCount}× {m.recipe.name}
                        </Text>
                        <Text color="fg.muted">{formatDateTime(m.createdAt)}</Text>
                      </Flex>
                    ))}
                  </Stack>
                )}
              </ContentCard>
            </>
          )}
        </Tabs.Content>

        <Tabs.Content value="payroll" pt={4}>
          <Flex gap={2} mb={4} wrap="wrap">
            <Button size="sm" onClick={() => payrollQuery.reload()}>
              Refresh
            </Button>
            <Button
              size="sm"
              colorPalette="blue"
              w={{ base: "full", sm: "auto" }}
              onClick={confirmRunPayroll}
            >
              Run payroll for current month
            </Button>
          </Flex>
          <Text fontSize="sm" color="fg.muted" mb={3} maxW={{ base: "full", md: "560px" }}>
            Queues payroll for all active employees from the 1st of this month through today.
          </Text>
          {payrollQuery.loading ? (
            <TableSkeleton rows={4} columns={4} />
          ) : payrollRuns.length === 0 ? (
            <EmptyState
              title="No payroll runs yet"
              description="Run payroll for the current month to calculate pay for all employees."
              action={
                <Button size="sm" colorPalette="blue" onClick={confirmRunPayroll}>
                  Run payroll
                </Button>
              }
            />
          ) : (
            payrollRuns.map((run) => (
              <ContentCard key={run.id} mb={4} p={0} overflow="hidden">
                <Box px={4} pt={4} pb={2}>
                  <Flex justify="space-between" wrap="wrap" gap={2}>
                    <Text fontWeight="semibold">
                      {formatDateTime(run.periodStart)} — {formatDateTime(run.periodEnd)}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {run.status}
                    </Text>
                  </Flex>
                </Box>
                <TableScrollArea>
                  <Table.Root size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Employee</Table.ColumnHeader>
                        <Table.ColumnHeader>Gross</Table.ColumnHeader>
                        <Table.ColumnHeader display={{ base: "none", sm: "table-cell" }}>
                          Deductions
                        </Table.ColumnHeader>
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
                          <Table.Cell display={{ base: "none", sm: "table-cell" }}>
                            <MoneyText amount={Number(l.deductions)} />
                          </Table.Cell>
                          <Table.Cell>
                            <MoneyText amount={Number(l.netPay)} />
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </TableScrollArea>
              </ContentCard>
            ))
          )}
        </Tabs.Content>
      </Tabs.Root>

      <FormDrawer
        open={empDrawer !== null}
        onClose={closeEmpDrawer}
        title={empDrawer === "edit" ? "Edit employee" : "Add employee"}
        size="sm"
        primaryLabel={empDrawer === "edit" ? "Save" : "Create"}
        onPrimary={handleSaveEmployee}
        primaryDisabled={!empForm.name.trim()}
      >
        <Stack gap={4} width="100%">
          <FormField label="Name" required>
            <Input
              size="sm"
              width="100%"
              placeholder="Name"
              value={empForm.name}
              onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
            />
          </FormField>
          <FormField label="Designation">
            <Input
              size="sm"
              width="100%"
              placeholder="Designation"
              value={empForm.designation}
              onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
            />
          </FormField>
          <FormField
            label="Salary"
            help="Base monthly gross pay before meal deductions and payroll adjustments."
          >
            <Input
              size="sm"
              width="100%"
              type="number"
              placeholder="Salary"
              value={empForm.salary}
              onChange={(e) => setEmpForm({ ...empForm, salary: e.target.value })}
            />
          </FormField>
        </Stack>
      </FormDrawer>

      <FormDialog
        open={clockOpen}
        onClose={closeClock}
        title="Record attendance"
        primaryLabel="Record"
        onPrimary={handleClock}
        primaryDisabled={!clockEmployeeId}
      >
        <Stack gap={4} width="100%">
          <FormField
            label="Employee"
            required
            help="Active employees only. Select branch in the header first."
          >
            <AppSelect
              width="100%"
              items={[
                { value: "", label: "Select employee" },
                ...activeEmployees.map((e) => ({ value: e.id, label: e.name })),
              ]}
              value={clockEmployeeId}
              onValueChange={setClockEmployeeId}
              placeholder="Select employee"
            />
          </FormField>
          <FormField label="Action" help="Clock in at shift start; clock out when the shift ends.">
            <AppSelect
              width="100%"
              items={[
                { value: "CLOCK_IN", label: "Clock in" },
                { value: "CLOCK_OUT", label: "Clock out" },
              ]}
              value={clockType}
              onValueChange={(v) => setClockType(v as "CLOCK_IN" | "CLOCK_OUT")}
            />
          </FormField>
        </Stack>
      </FormDialog>

      <FormDrawer
        open={recipeDrawerOpen}
        onClose={closeRecipeDrawer}
        title="New staff meal recipe"
        description="Ingredients required for one staff meal (staff inventory pool)."
        size="md"
        primaryLabel="Save recipe"
        onPrimary={handleSaveRecipe}
        primaryDisabled={!recipeForm.name.trim()}
      >
        <FormSection title="Recipe">
          <FormField label="Recipe name" help="e.g. Staff Lunch">
            <Input
              size="sm"
              width="100%"
              placeholder="Recipe name"
              value={recipeForm.name}
              onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
            />
          </FormField>
        </FormSection>
        <FormSection title="Ingredients">
          <Stack gap={3} width="100%">
            {recipeForm.lines.map((line, idx) => (
              <Flex key={idx} gap={2} direction={{ base: "column", sm: "row" }} width="100%">
                <AppSelect
                  width="100%"
                  items={[
                    { value: "", label: "Select ingredient" },
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
                  placeholder="Select ingredient"
                />
                <Input
                  size="sm"
                  width="100%"
                  type="number"
                  step="0.001"
                  placeholder="Qty per meal"
                  value={line.quantity}
                  onChange={(e) => {
                    const lines = [...recipeForm.lines];
                    lines[idx] = { ...lines[idx], quantity: e.target.value };
                    setRecipeForm({ ...recipeForm, lines });
                  }}
                />
              </Flex>
            ))}
            <Button
              size="sm"
              variant="outline"
              alignSelf="flex-start"
              onClick={() =>
                setRecipeForm({
                  ...recipeForm,
                  lines: [...recipeForm.lines, { inventoryItemId: "", quantity: "" }],
                })
              }
            >
              + Ingredient line
            </Button>
          </Stack>
        </FormSection>
      </FormDrawer>

      <FormDrawer
        open={mealDrawerOpen}
        onClose={closeMealDrawer}
        title="Record staff meal"
        size="sm"
        primaryLabel="Record meal"
        onPrimary={handleStaffMeal}
        primaryDisabled={
          !mealForm.employeeId || !mealForm.staffMealRecipeId || !mealForm.mealCount
        }
      >
        <Stack gap={4} width="100%">
          <FormField label="Employee" required>
            <AppSelect
              width="100%"
              items={[
                { value: "", label: "Employee" },
                ...activeEmployees.map((e) => ({ value: e.id, label: e.name })),
              ]}
              value={mealForm.employeeId}
              onValueChange={(v) => setMealForm({ ...mealForm, employeeId: v })}
              placeholder="Employee"
            />
          </FormField>
          <FormField label="Meal recipe" required>
            <AppSelect
              width="100%"
              items={[
                { value: "", label: "Meal recipe" },
                ...mealRecipes.map((r) => ({ value: r.id, label: r.name })),
              ]}
              value={mealForm.staffMealRecipeId}
              onValueChange={(v) => setMealForm({ ...mealForm, staffMealRecipeId: v })}
              placeholder="Meal recipe"
            />
          </FormField>
          <FormField
            label="Meals consumed"
            help="Inventory is deducted by recipe × count."
          >
            <Input
              size="sm"
              width="100%"
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
              width="100%"
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
        </Stack>
      </FormDrawer>
    </DashboardShell>
  );
}
