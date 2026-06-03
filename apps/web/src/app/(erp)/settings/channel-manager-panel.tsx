"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Flex, Input, Stack, Table, Text } from "@chakra-ui/react";
import { ContentCard, FormField, TableScrollArea } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { appToast } from "@/lib/app-toast";
import type { TenantHeaders } from "@/lib/api-client";

const CHANNEL_ADAPTERS = new Set(["channel_manager", "ota_inquiry"]);

type AvailabilityExport = {
  from: string;
  to: string;
  roomTypes: {
    roomTypeName: string;
    inventory: { date: string; availableCount: number; totalRooms: number }[];
  }[];
};

type AvailabilityBlock = {
  id: string;
  startDate: string;
  endDate: string;
  roomId: string | null;
  reason: string | null;
};

export function ChannelManagerPanel({
  tenant,
  connectionId,
}: {
  tenant: TenantHeaders;
  connectionId: string;
}) {
  const [exportRange, setExportRange] = useState({
    from: new Date().toISOString().slice(0, 10),
    to: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  });
  const [exportData, setExportData] = useState<AvailabilityExport | null>(null);
  const [exporting, setExporting] = useState(false);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [blockForm, setBlockForm] = useState({
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [savingBlock, setSavingBlock] = useState(false);

  const loadBlocks = useCallback(async () => {
    try {
      const data = await apiFetch<AvailabilityBlock[]>(
        `/integrations/connections/${connectionId}/availability-blocks`,
        { tenant },
      );
      setBlocks(data);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load blocks");
    }
  }, [tenant, connectionId]);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  const runExport = async () => {
    setExporting(true);
    try {
      const data = await apiFetch<AvailabilityExport>(
        `/integrations/connections/${connectionId}/availability-export?from=${exportRange.from}&to=${exportRange.to}`,
        { tenant },
      );
      setExportData(data);
      appToast.success("Availability exported");
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const addBlock = async () => {
    if (!blockForm.startDate || !blockForm.endDate) {
      appToast.error("Start and end dates are required");
      return;
    }
    setSavingBlock(true);
    try {
      await apiFetch(`/integrations/connections/${connectionId}/availability-blocks`, {
        method: "POST",
        tenant,
        body: JSON.stringify({
          startDate: blockForm.startDate,
          endDate: blockForm.endDate,
          reason: blockForm.reason || undefined,
        }),
      });
      setBlockForm({ startDate: "", endDate: "", reason: "" });
      appToast.success("Availability block added");
      await loadBlocks();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to add block");
    } finally {
      setSavingBlock(false);
    }
  };

  const removeBlock = async (blockId: string) => {
    try {
      await apiFetch(
        `/integrations/connections/${connectionId}/availability-blocks/${blockId}`,
        { method: "DELETE", tenant },
      );
      appToast.success("Block removed");
      await loadBlocks();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to remove block");
    }
  };

  return (
    <ContentCard mb={6}>
      <Text fontWeight="semibold" mb={2}>
        Channel manager
      </Text>
      <Text fontSize="sm" color="fg.muted" mb={4}>
        Export nightly availability for OTAs and block dates from sale. Import bookings via the
        webhook event booking.import.
      </Text>

      <Stack gap={3} mb={4}>
        <Flex gap={2} wrap="wrap" align="flex-end">
          <FormField label="Export from">
            <Input
              size="sm"
              type="date"
              aria-label="Export from"
              value={exportRange.from}
              onChange={(e) => setExportRange((r) => ({ ...r, from: e.target.value }))}
            />
          </FormField>
          <FormField label="Export to">
            <Input
              size="sm"
              type="date"
              aria-label="Export to"
              value={exportRange.to}
              onChange={(e) => setExportRange((r) => ({ ...r, to: e.target.value }))}
            />
          </FormField>
          <Button size="sm" colorPalette="blue" loading={exporting} onClick={runExport}>
            Export availability
          </Button>
        </Flex>
        {exportData && (
          <Text fontSize="sm" data-testid="channel-export-summary">
            Exported {exportData.roomTypes?.length ?? 0} room type(s) from {exportData.from} to{" "}
            {exportData.to}.
          </Text>
        )}
      </Stack>

      <Text fontWeight="medium" mb={2}>
        Manual availability blocks
      </Text>
      <Flex gap={2} wrap="wrap" align="flex-end" mb={3}>
        <FormField label="Block start">
          <Input
            size="sm"
            type="date"
            aria-label="Block start"
            value={blockForm.startDate}
            onChange={(e) => setBlockForm((f) => ({ ...f, startDate: e.target.value }))}
          />
        </FormField>
        <FormField label="Block end">
          <Input
            size="sm"
            type="date"
            aria-label="Block end"
            value={blockForm.endDate}
            onChange={(e) => setBlockForm((f) => ({ ...f, endDate: e.target.value }))}
          />
        </FormField>
        <FormField label="Reason">
          <Input
            size="sm"
            placeholder="Renovation"
            value={blockForm.reason}
            onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </FormField>
        <Button size="sm" loading={savingBlock} onClick={addBlock}>
          Add block
        </Button>
      </Flex>
      {blocks.length > 0 && (
        <TableScrollArea>
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Dates</Table.ColumnHeader>
                <Table.ColumnHeader>Reason</Table.ColumnHeader>
                <Table.ColumnHeader />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {blocks.map((b) => (
                <Table.Row key={b.id}>
                  <Table.Cell>
                    {b.startDate} → {b.endDate}
                  </Table.Cell>
                  <Table.Cell>{b.reason ?? "—"}</Table.Cell>
                  <Table.Cell>
                    <Button size="xs" variant="outline" onClick={() => removeBlock(b.id)}>
                      Remove
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </TableScrollArea>
      )}
    </ContentCard>
  );
}

export function isChannelAdapterKey(adapterKey: string) {
  return CHANNEL_ADAPTERS.has(adapterKey);
}
