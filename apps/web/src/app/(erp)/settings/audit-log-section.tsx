"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Input, Stack, Table, Text } from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import { ContentCard, EmptyState, FormField, TableScrollArea, TableSkeleton } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { appToast } from "@/lib/app-toast";
import type { TenantHeaders } from "@/lib/api-client";
import { shortId } from "@/lib/format";

type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null } | null;
};

const ENTITY_FILTER_OPTIONS = [
  { value: "", label: "All entities" },
  { value: "vendor", label: "Vendor" },
  { value: "purchase_order", label: "Purchase order" },
  { value: "goods_receipt", label: "Goods receipt" },
  { value: "branch", label: "Branch" },
  { value: "organization", label: "Organization" },
  { value: "user_organization", label: "Team member" },
  { value: "join_request", label: "Join request" },
  { value: "journal_entry", label: "Journal entry" },
  { value: "reservation", label: "Reservation" },
  { value: "inventory_item", label: "Inventory item" },
  { value: "inventory_movement", label: "Inventory movement" },
  { value: "employee", label: "Employee" },
  { value: "order", label: "POS order" },
];

export function AuditLogSection({ tenant }: { tenant: TenantHeaders | undefined }) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("limit", "100");
      const qs = params.toString();
      const data = await apiFetch<AuditLogRow[]>(
        `/audit/logs${qs ? `?${qs}` : ""}`,
        { tenant },
      );
      setLogs(data);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [tenant, entityType, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Stack gap={4}>
      <ContentCard>
        <Text fontWeight="semibold" mb={3}>
          Filter
        </Text>
        <Flex gap={3} wrap="wrap" align="flex-end">
          <FormField label="Entity type">
            <AppSelect
              items={ENTITY_FILTER_OPTIONS}
              value={entityType}
              onValueChange={setEntityType}
              width="200px"
              aria-label="Entity type filter"
            />
          </FormField>
          <FormField label="From">
            <Input
              type="date"
              size="sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </FormField>
          <FormField label="To">
            <Input type="date" size="sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </FormField>
          <Button size="sm" onClick={load}>
            Apply
          </Button>
        </Flex>
      </ContentCard>

      <ContentCard>
        <Flex justify="space-between" align="center" mb={3}>
          <Text fontWeight="semibold">Recent activity</Text>
          <Button size="sm" variant="outline" onClick={load}>
            Refresh
          </Button>
        </Flex>
        {loading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : logs.length === 0 ? (
          <EmptyState
            title="No audit entries"
            description="Changes to branches, team, procurement, journals, reservations, inventory, HR, and POS orders appear here."
          />
        ) : (
          <TableScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>When</Table.ColumnHeader>
                  <Table.ColumnHeader>User</Table.ColumnHeader>
                  <Table.ColumnHeader>Action</Table.ColumnHeader>
                  <Table.ColumnHeader>Entity</Table.ColumnHeader>
                  <Table.ColumnHeader>Details</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {logs.map((row) => (
                  <Table.Row key={row.id}>
                    <Table.Cell whiteSpace="nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm">{row.user?.name ?? row.user?.email ?? "—"}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm" fontFamily="mono">
                        {row.action}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontSize="sm">
                        {row.entityType}
                        {row.entityId ? ` · ${shortId(row.entityId)}` : ""}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      {row.metadata && Object.keys(row.metadata).length > 0 ? (
                        <Box fontSize="xs" color="fg.muted" fontFamily="mono">
                          {JSON.stringify(row.metadata)}
                        </Box>
                      ) : (
                        <Text fontSize="xs" color="fg.muted">
                          —
                        </Text>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </TableScrollArea>
        )}
      </ContentCard>
    </Stack>
  );
}
