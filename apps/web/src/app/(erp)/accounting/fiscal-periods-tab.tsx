"use client";

import { useState } from "react";
import { Badge, Button, Flex, Input, Stack, Table, Text } from "@chakra-ui/react";
import {
  ContentCard,
  EmptyState,
  FormField,
  TableScrollArea,
  TableSkeleton,
} from "@erp/ui";
import { FormDrawer } from "@/components/form-drawer";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";
import { useAsync } from "@/lib/use-async";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";
import { formatDateTime } from "@/lib/format";
import { appToast } from "@/lib/app-toast";

type FiscalPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  closedAt: string | null;
};

export function FiscalPeriodsTab() {
  const tenant = useTenantHeaders();
  const { ask, dialog } = useConfirmDialog();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });

  const periodsQuery = useAsync(
    () => apiFetch<FiscalPeriod[]>("/accounting/fiscal-periods", { tenant }),
    [tenant.organizationId],
  );

  const periods = periodsQuery.data ?? [];

  const handleCreate = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      appToast.error("Name and dates are required.");
      return;
    }
    try {
      await apiFetch("/accounting/fiscal-periods", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          name: form.name.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
        }),
      });
      appToast.success("Fiscal period created.");
      setDrawerOpen(false);
      setForm({ name: "", startDate: "", endDate: "" });
      periodsQuery.reload();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to create period");
    }
  };

  const setPeriodStatus = async (id: string, action: "close" | "reopen") => {
    try {
      await apiFetch(`/accounting/fiscal-periods/${id}/${action}`, {
        method: "PATCH",
        tenant,
      });
      appToast.success(action === "close" ? "Period closed." : "Period reopened.");
      periodsQuery.reload();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to update period");
    }
  };

  return (
    <>
      {dialog}
      <Flex gap={2} mb={4} wrap="wrap">
        <Button size="sm" onClick={() => periodsQuery.reload()}>
          Refresh
        </Button>
        <Button
          size="sm"
          colorPalette="blue"
          w={{ base: "full", sm: "auto" }}
          onClick={() => setDrawerOpen(true)}
        >
          + New period
        </Button>
      </Flex>

      <ContentCard p={0} overflow="hidden">
        {periodsQuery.loading ? (
          <TableSkeleton rows={4} columns={5} />
        ) : periods.length === 0 ? (
          <EmptyState
            title="No fiscal periods"
            description="Create an open period before posting journals. Closed periods block new entries for dates in that range."
            action={
              <Button size="sm" colorPalette="blue" onClick={() => setDrawerOpen(true)}>
                Create first period
              </Button>
            }
          />
        ) : (
          <TableScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Name</Table.ColumnHeader>
                  <Table.ColumnHeader>Range</Table.ColumnHeader>
                  <Table.ColumnHeader>Status</Table.ColumnHeader>
                  <Table.ColumnHeader />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {periods.map((p) => (
                  <Table.Row key={p.id}>
                    <Table.Cell fontWeight="medium">{p.name}</Table.Cell>
                    <Table.Cell whiteSpace="nowrap">
                      {p.startDate.slice(0, 10)} – {p.endDate.slice(0, 10)}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge colorPalette={p.status === "OPEN" ? "green" : "gray"}>
                        {p.status}
                      </Badge>
                      {p.closedAt && (
                        <Text fontSize="xs" color="fg.muted" mt={1}>
                          Closed {formatDateTime(p.closedAt)}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap={2} justify="flex-end">
                        {p.status === "OPEN" ? (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() =>
                              ask({
                                title: "Close fiscal period",
                                description: `Close "${p.name}"? New journal entries in this date range will be blocked until you reopen.`,
                                confirmLabel: "Close period",
                                onConfirm: () => setPeriodStatus(p.id, "close"),
                              })
                            }
                          >
                            Close
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setPeriodStatus(p.id, "reopen")}
                          >
                            Reopen
                          </Button>
                        )}
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </TableScrollArea>
        )}
      </ContentCard>

      <FormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New fiscal period"
        primaryLabel="Create period"
        onPrimary={handleCreate}
      >
        <Stack gap={4}>
          <FormField label="Name" required>
            <Input
              placeholder="e.g. FY 2026 Q1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label="Start date" required>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </FormField>
          <FormField label="End date" required>
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </FormField>
        </Stack>
      </FormDrawer>
    </>
  );
}
