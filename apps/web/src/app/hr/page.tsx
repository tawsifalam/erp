"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  NativeSelect,
  Stack,
  Table,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader, MoneyText, EmptyState, LoadingState } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";
import { useAsync } from "@/lib/use-async";
import { formatDateTime } from "@/lib/format";

type Employee = { id: string; name: string; designation: string; salary: string };
type PayrollRun = {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  lines: { employee: { name: string }; grossPay: string; netPay: string }[];
};

export default function HrPage() {
  const tenant = useTenantHeaders();
  const [tab, setTab] = useState("employees");
  const [empForm, setEmpForm] = useState({ name: "", designation: "", salary: "" });
  const [clockEmployeeId, setClockEmployeeId] = useState("");
  const [clockType, setClockType] = useState<"CLOCK_IN" | "CLOCK_OUT">("CLOCK_IN");
  const [message, setMessage] = useState<string | null>(null);

  const employeesQuery = useAsync(
    () => apiFetch<Employee[]>("/hr/employees", { tenant }),
    [tenant.organizationId],
  );

  const payrollQuery = useAsync(
    () => apiFetch<PayrollRun[]>("/payroll/runs", { tenant }),
    [tenant.organizationId],
  );

  const employees = employeesQuery.data ?? [];
  const payrollRuns = payrollQuery.data ?? [];

  const handleAddEmployee = async () => {
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
  };

  const handleClock = async () => {
    if (!clockEmployeeId) return;
    await apiFetch("/hr/attendance/clock", {
      method: "POST",
      tenant,
      body: JSON.stringify({ employeeId: clockEmployeeId, type: clockType }),
    });
    setMessage(`${clockType === "CLOCK_IN" ? "Clocked in" : "Clocked out"} successfully`);
  };

  const runPayroll = async () => {
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
    setMessage(`Payroll run queued: ${job.id}`);
    payrollQuery.reload();
  };

  return (
    <DashboardShell title="HR">
      <PageHeader title="Human Resources" description="Employees, attendance, and payroll" />

      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)} mb={4}>
        <Tabs.List>
          <Tabs.Trigger value="employees">Employees</Tabs.Trigger>
          <Tabs.Trigger value="attendance">Attendance</Tabs.Trigger>
          <Tabs.Trigger value="payroll">Payroll</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="employees" pt={4}>
          <Box bg="white" borderRadius="md" p={4} mb={4}>
            <Text fontWeight="semibold" mb={3}>
              Add employee
            </Text>
            <Flex gap={2} wrap="wrap">
              <Input
                size="sm"
                w="180px"
                placeholder="Name"
                value={empForm.name}
                onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
              />
              <Input
                size="sm"
                w="160px"
                placeholder="Designation"
                value={empForm.designation}
                onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
              />
              <Input
                size="sm"
                w="120px"
                type="number"
                placeholder="Salary"
                value={empForm.salary}
                onChange={(e) => setEmpForm({ ...empForm, salary: e.target.value })}
              />
              <Button size="sm" colorPalette="blue" onClick={handleAddEmployee}>
                Add
              </Button>
            </Flex>
          </Box>
          {employeesQuery.loading && <LoadingState />}
          <Box bg="white" borderRadius="md" p={4}>
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
            {!employeesQuery.loading && employees.length === 0 && (
              <EmptyState message="No employees yet." />
            )}
          </Box>
        </Tabs.Content>

        <Tabs.Content value="attendance" pt={4}>
          <Box bg="white" borderRadius="md" p={4} maxW="480px">
            <Stack gap={3}>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={clockEmployeeId}
                  onChange={(e) => setClockEmployeeId(e.target.value)}
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </NativeSelect.Field>
              </NativeSelect.Root>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={clockType}
                  onChange={(e) => setClockType(e.target.value as "CLOCK_IN" | "CLOCK_OUT")}
                >
                  <option value="CLOCK_IN">Clock in</option>
                  <option value="CLOCK_OUT">Clock out</option>
                </NativeSelect.Field>
              </NativeSelect.Root>
              <Button size="sm" colorPalette="green" w="fit-content" onClick={handleClock}>
                Record attendance
              </Button>
            </Stack>
          </Box>
        </Tabs.Content>

        <Tabs.Content value="payroll" pt={4}>
          <Button size="sm" mb={4} colorPalette="blue" onClick={runPayroll}>
            Run payroll for current month
          </Button>
          {payrollQuery.loading && <LoadingState />}
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
                <Table.Body>
                  {run.lines.map((l, i) => (
                    <Table.Row key={i}>
                      <Table.Cell>{l.employee.name}</Table.Cell>
                      <Table.Cell>
                        <MoneyText amount={Number(l.netPay)} />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          ))}
          {!payrollQuery.loading && payrollRuns.length === 0 && (
            <EmptyState message="No payroll runs yet." />
          )}
        </Tabs.Content>
      </Tabs.Root>

      {message && (
        <Text mt={4} fontSize="sm" color="green.600">
          {message}
        </Text>
      )}
    </DashboardShell>
  );
}
