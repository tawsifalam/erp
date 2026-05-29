"use client";

import { useEffect, useState } from "react";
import { Box, Button, Table } from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader, MoneyText } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";

type Employee = { id: string; name: string; designation: string; salary: string };

export default function HrPage() {
  const tenant = useTenantHeaders();
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    apiFetch<Employee[]>("/hr/employees", { tenant }).then(setEmployees).catch(console.error);
  }, [tenant.organizationId]);

  const runPayroll = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    apiFetch("/hr/payroll/runs", {
      method: "POST",
      tenant,
      body: JSON.stringify({
        periodStart: start.toISOString(),
        periodEnd: now.toISOString(),
      }),
    }).then(() => alert("Payroll run queued"));
  };

  return (
    <DashboardShell title="HR">
      <PageHeader title="Employees" description="Staff and payroll" />
      <Button size="sm" mb={4} onClick={runPayroll}>
        Run payroll
      </Button>
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
      </Box>
    </DashboardShell>
  );
}
