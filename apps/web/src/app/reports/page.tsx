"use client";

import { useEffect } from "react";
import { Box, Button, Flex, Table, Text } from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader, EmptyState, LoadingState } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";
import { useAsync } from "@/lib/use-async";
import { formatDateTime } from "@/lib/format";

type ReportJob = {
  id: string;
  type: string;
  status: string;
  fileUrl?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export default function ReportsPage() {
  const tenant = useTenantHeaders();

  const jobsQuery = useAsync(
    () => apiFetch<ReportJob[]>("/reporting/jobs", { tenant }),
    [tenant.organizationId],
  );

  const exportCsv = async () => {
    await apiFetch<{ id: string }>("/reporting/export", {
      method: "POST",
      tenant,
      body: JSON.stringify({ type: "summary" }),
    });
    jobsQuery.reload();
  };

  // Poll while any job is pending/processing
  useEffect(() => {
    const jobs = jobsQuery.data ?? [];
    const pending = jobs.some((j) => j.status === "PENDING" || j.status === "PROCESSING");
    if (!pending) return;
    const t = setInterval(() => jobsQuery.reload(), 3000);
    return () => clearInterval(t);
  }, [jobsQuery.data, jobsQuery.reload]);

  const jobs = jobsQuery.data ?? [];

  return (
    <DashboardShell title="Reports">
      <PageHeader title="Reports & exports" description="Async CSV exports via background jobs" />

      <Flex gap={2} mb={4}>
        <Button size="sm" colorPalette="blue" onClick={exportCsv}>
          Export summary CSV
        </Button>
        <Button size="sm" variant="outline" onClick={() => jobsQuery.reload()}>
          Refresh
        </Button>
      </Flex>

      {jobsQuery.loading && <LoadingState />}
      {jobsQuery.error && (
        <Text color="red.500" mb={2}>
          {jobsQuery.error}
        </Text>
      )}

      <Box bg="white" borderRadius="md" p={4}>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Type</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader>Created</Table.ColumnHeader>
              <Table.ColumnHeader>Download</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {jobs.map((j) => (
              <Table.Row key={j.id}>
                <Table.Cell>{j.type}</Table.Cell>
                <Table.Cell>{j.status}</Table.Cell>
                <Table.Cell>{formatDateTime(j.createdAt)}</Table.Cell>
                <Table.Cell>
                  {j.fileUrl ? (
                    <a href={j.fileUrl} target="_blank" rel="noreferrer">
                      Download
                    </a>
                  ) : (
                    "—"
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {!jobsQuery.loading && jobs.length === 0 && (
          <EmptyState message="No report jobs yet. Export a summary to get started." />
        )}
      </Box>
    </DashboardShell>
  );
}
