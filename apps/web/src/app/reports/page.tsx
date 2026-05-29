"use client";

import { useState } from "react";
import { Box, Button, Text } from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";

export default function ReportsPage() {
  const tenant = useTenantHeaders();
  const [jobId, setJobId] = useState<string | null>(null);

  const exportCsv = async () => {
    const job = await apiFetch<{ id: string }>("/reporting/export", {
      method: "POST",
      tenant,
      body: JSON.stringify({ type: "summary" }),
    });
    setJobId(job.id);
  };

  return (
    <DashboardShell title="Reports">
      <PageHeader title="Exports" description="Async report generation via BullMQ" />
      <Button onClick={exportCsv}>Export summary CSV</Button>
      {jobId && (
        <Text mt={4} color="fg.muted">
          Report job queued: {jobId}
        </Text>
      )}
    </DashboardShell>
  );
}
