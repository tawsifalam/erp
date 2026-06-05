"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Flex, Input, Table, Text } from "@chakra-ui/react";
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
  TableScrollArea,
} from "@erp/ui";
import { apiFetch, apiFetchBlob } from "@/lib/api-client";
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
  requiresDateRange?: boolean;
  requiresAsOf?: boolean;
  requiresAccountCode?: boolean;
  supportsPdf?: boolean;
};

const FINANCIAL_TYPES = new Set([
  "trial_balance",
  "profit_and_loss",
  "balance_sheet",
  "general_ledger",
]);

function defaultDateRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    asOf: to.toISOString().slice(0, 10),
  };
}

export default function ReportsPage() {
  const tenant = useTenantHeaders();
  const [exportType, setExportType] = useState("branch_summary");
  const [dates, setDates] = useState(defaultDateRange);
  const [accountCode, setAccountCode] = useState("1000");

  const typesQuery = useAsync(
    () => apiFetch<ReportType[]>("/reporting/types", { tenant }),
    [tenant.organizationId],
  );

  const jobsQuery = useAsync(
    () => apiFetch<ReportJob[]>("/reporting/jobs", { tenant }),
    [tenant.organizationId],
  );

  const selectedType = useMemo(
    () => typesQuery.data?.find((t) => t.code === exportType),
    [typesQuery.data, exportType],
  );

  const isFinancial = FINANCIAL_TYPES.has(exportType);

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

  const exportReport = async (format: "csv" | "pdf") => {
    if (selectedType?.requiresBranch && !tenant.branchId) {
      appToast.error("Select a branch in the header for this report.");
      return;
    }
    if (format === "pdf" && !selectedType?.supportsPdf) {
      appToast.error("PDF export is only available for financial reports.");
      return;
    }
    try {
      await apiFetch<{ id: string }>("/reporting/export", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          type: exportType,
          branchId: selectedType?.requiresBranch ? tenant.branchId : undefined,
          from: selectedType?.requiresDateRange ? dates.from : undefined,
          to:
            selectedType?.requiresDateRange || selectedType?.requiresAsOf
              ? dates.to
              : undefined,
          asOf: selectedType?.requiresAsOf ? dates.asOf : undefined,
          accountCode: selectedType?.requiresAccountCode ? accountCode : undefined,
          format,
        }),
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

      {!tenant.branchId && !isFinancial && <BranchRequiredNotice />}

      <Text fontSize="sm" color="fg.muted" mb={3}>
        Exports run in the background — completed files appear in the table below. Financial
        reports are organization-wide and use your chart of accounts.
      </Text>

      <Flex gap={2} mb={4} wrap="wrap" align="flex-end">
        <FormField
          label="Report type"
          help={
            isFinancial
              ? "GL reports use journal entries for your organization."
              : "Branch-scoped reports require a branch in the header."
          }
        >
          {typesQuery.loading ? (
            <SelectSkeleton width="220px" />
          ) : (
            <AppSelect
              items={types.map((t) => ({ value: t.code, label: t.label }))}
              value={exportType}
              onValueChange={setExportType}
              width="260px"
              placeholder="Report type"
            />
          )}
        </FormField>

        {selectedType?.requiresDateRange && (
          <>
            <FormField label="From">
              <Input
                size="sm"
                type="date"
                value={dates.from}
                onChange={(e) => setDates({ ...dates, from: e.target.value })}
              />
            </FormField>
            <FormField label="To">
              <Input
                size="sm"
                type="date"
                value={dates.to}
                onChange={(e) => setDates({ ...dates, to: e.target.value })}
              />
            </FormField>
          </>
        )}

        {selectedType?.requiresAsOf && (
          <FormField label="As of">
            <Input
              size="sm"
              type="date"
              value={dates.asOf}
              onChange={(e) => setDates({ ...dates, asOf: e.target.value })}
            />
          </FormField>
        )}

        {selectedType?.requiresAccountCode && (
          <FormField label="Account code">
            <Input
              size="sm"
              width="120px"
              value={accountCode}
              onChange={(e) => setAccountCode(e.target.value)}
            />
          </FormField>
        )}

        <Button
          size="sm"
          colorPalette="blue"
          onClick={() => exportReport("csv")}
          disabled={typesQuery.loading}
        >
          Export CSV
        </Button>
        {selectedType?.supportsPdf && (
          <Button
            size="sm"
            variant="outline"
            colorPalette="blue"
            onClick={() => exportReport("pdf")}
            disabled={typesQuery.loading}
          >
            Export PDF
          </Button>
        )}
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
            <TableScrollArea>
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
                        {j.status === "COMPLETED" && j.fileUrl ? (
                          <Button
                            size="xs"
                            variant="plain"
                            colorPalette="blue"
                            data-testid={`download-report-${j.id}`}
                            onClick={async () => {
                              try {
                                const blob = await apiFetchBlob(
                                  `/reporting/jobs/${j.id}/download`,
                                  { tenant },
                                );
                                const isPdf = j.fileUrl?.endsWith(".pdf");
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `${j.type}-${j.id}.${isPdf ? "pdf" : "csv"}`;
                                a.click();
                                URL.revokeObjectURL(url);
                              } catch (e) {
                                appToast.error(
                                  e instanceof Error ? e.message : "Failed to download report",
                                );
                              }
                            }}
                          >
                            Download
                          </Button>
                        ) : (
                          "—"
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </TableScrollArea>
            {jobs.length === 0 && (
              <EmptyState
                title="No report jobs yet"
                description="Export a CSV or PDF report to generate a downloadable file. Jobs appear here while processing."
                action={
                  <Button
                    size="sm"
                    colorPalette="blue"
                    onClick={() => exportReport("csv")}
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
