"use client";

import { useEffect, useState } from "react";
import { Button, Flex, Table, Text } from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import { BranchRequiredNotice } from "@/components/branch-required-notice";
import { ModulePageHeader } from "@/components/module-page-header";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  ContentCard,
  EmptyState,
  FormField,
  SelectSkeleton,
  StatusBadge,
  TableSkeleton,
} from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";
import { useAsync } from "@/lib/use-async";
import { formatDateTime } from "@/lib/format";
import { appToast } from "@/lib/app-toast";

type ReportJob = {
  id: string;
  type: string;
  status: string;
  fileUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

type ReportType = {
  code: string;
  label: string;
  requiresBranch: boolean;
};

export default function ReportsPage() {
  const tenant = useTenantHeaders();
  const [exportType, setExportType] = useState("branch_summary");

  const typesQuery = useAsync(
    () => apiFetch<ReportType[]>("/reporting/types", { tenant }),
    [tenant.organizationId],
  );

  const jobsQuery = useAsync(
    () => apiFetch<ReportJob[]>("/reporting/jobs", { tenant }),
    [tenant.organizationId],
  );

  useEffect(() => {
    if (typesQuery.data?.length && !typesQuery.data.find((t) => t.code === exportType)) {
      setExportType(typesQuery.data[0].code);
    }
  }, [typesQuery.data, exportType]);

  useEffect(() => {
    const jobs = jobsQuery.data ?? [];
    const pending = jobs.some((j) => j.status === "PENDING" || j.status === "PROCESSING");
    if (!pending) return;
    const t = setInterval(() => jobsQuery.reload(), 3000);
    return () => clearInterval(t);
  }, [jobsQuery.data, jobsQuery.reload]);

  useEffect(() => {
    if (jobsQuery.error) appToast.error(jobsQuery.error);
  }, [jobsQuery.error]);

  const exportCsv = async () => {
    if (!tenant.branchId) {
      appToast.error("Select a branch in the header to export branch reports.");
      return;
    }
    try {
      await apiFetch<{ id: string }>("/reporting/export", {
        method: "POST",
        tenant,
        body: JSON.stringify({ type: exportType, branchId: tenant.branchId }),
      });
      appToast.success("Export queued — refresh or wait for completion");
      jobsQuery.reload();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const jobs = jobsQuery.data ?? [];
  const types = typesQuery.data ?? [];

  return (
    <DashboardShell>
      <ModulePageHeader />

      {!tenant.branchId && <BranchRequiredNotice />}

      <Text fontSize="sm" color="fg.muted" mb={3}>
        Exports run in the background — completed files appear in the table below.
      </Text>

      <Flex gap={2} mb={4} wrap="wrap" align="flex-end">
        <FormField label="Report type" help="Branch-scoped reports require a branch in the header.">
          {typesQuery.loading ? (
            <SelectSkeleton width="220px" />
          ) : (
            <AppSelect
              items={types.map((t) => ({ value: t.code, label: t.label }))}
              value={exportType}
              onValueChange={setExportType}
              width="220px"
              placeholder="Report type"
            />
          )}
        </FormField>
        <Button
          size="sm"
          colorPalette="blue"
          onClick={exportCsv}
          disabled={typesQuery.loading}
        >
          Export CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => jobsQuery.reload()}
          disabled={typesQuery.loading}
        >
          Refresh
        </Button>
      </Flex>

      <ContentCard>
        {jobsQuery.loading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : (
          <>
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
                <Table.Cell>
                  <StatusBadge status={j.status} />
                  {j.status === "FAILED" && j.errorMessage && (
                    <Text fontSize="xs" color="red.500">
                      {j.errorMessage}
                    </Text>
                  )}
                </Table.Cell>
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
            {jobs.length === 0 && (
              <EmptyState
                title="No report jobs yet"
                description="Export a CSV report to generate a downloadable file. Jobs appear here while processing."
                action={
                  <Button
                    size="sm"
                    colorPalette="blue"
                    onClick={exportCsv}
                    disabled={typesQuery.loading}
                  >
                    Export CSV
                  </Button>
                }
              />
            )}
          </>
        )}
      </ContentCard>
    </DashboardShell>
  );
}
