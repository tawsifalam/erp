"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import { FormDrawer } from "@/components/form-drawer";
import { ContentCard, EmptyState, FormField, TableSkeleton, TableScrollArea } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { appToast } from "@/lib/app-toast";
import type { TenantHeaders } from "@/lib/api-client";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";

type Adapter = {
  key: string;
  name: string;
  description: string;
  credentialFields: { key: string; label: string; secret?: boolean; required?: boolean }[];
  supportedEvents: string[];
};

type Connection = {
  id: string;
  adapterKey: string;
  adapterName: string;
  name: string;
  status: string;
  branchId: string | null;
  branchName: string | null;
  webhookUrl: string;
  webhookSecretPreview: string;
  credentialsMasked: Record<string, string>;
};

type WebhookEvent = {
  id: string;
  eventType: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

type Branch = { id: string; name: string };

export function IntegrationsSection({ tenant }: { tenant: TenantHeaders | undefined }) {
  const { ask, dialog } = useConfirmDialog();
  const [loading, setLoading] = useState(true);
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [form, setForm] = useState({
    adapterKey: "generic_webhook",
    name: "",
    branchId: "",
    credentials: {} as Record<string, string>,
  });

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [adapterList, connectionList, branchList] = await Promise.all([
        apiFetch<Adapter[]>("/integrations/adapters", { tenant }),
        apiFetch<Connection[]>("/integrations/connections", { tenant }),
        apiFetch<Branch[]>("/tenants/branches", { tenant }),
      ]);
      setAdapters(adapterList);
      setConnections(connectionList);
      setBranches(branchList);
      setSelectedId((cur) => cur || connectionList[0]?.id || "");
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  const loadEvents = useCallback(async () => {
    if (!tenant || !selectedId) {
      setEvents([]);
      return;
    }
    setEventsLoading(true);
    try {
      const data = await apiFetch<WebhookEvent[]>(
        `/integrations/connections/${selectedId}/webhook-events?limit=20`,
        { tenant },
      );
      setEvents(data);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load webhook events");
    } finally {
      setEventsLoading(false);
    }
  }, [tenant, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const selectedAdapter = adapters.find((a) => a.key === form.adapterKey);
  const selectedConnection = connections.find((c) => c.id === selectedId);

  const createConnection = async () => {
    if (!tenant) return;
    const name = form.name.trim();
    if (!name) {
      appToast.error("Connection name is required");
      return;
    }
    setSaving(true);
    try {
      const result = await apiFetch<Connection & { webhookSecret: string }>(
        "/integrations/connections",
        {
          method: "POST",
          tenant,
          body: JSON.stringify({
            adapterKey: form.adapterKey,
            name,
            branchId: form.branchId || null,
            credentials: Object.keys(form.credentials).length ? form.credentials : undefined,
          }),
        },
      );
      setRevealedSecret(result.webhookSecret);
      setDrawerOpen(false);
      setForm({ adapterKey: "generic_webhook", name: "", branchId: "", credentials: {} });
      appToast.success("Integration connection created");
      await load();
      setSelectedId(result.id);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to create connection");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (conn: Connection) => {
    if (!tenant) return;
    const next = conn.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      await apiFetch(`/integrations/connections/${conn.id}`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify({ status: next }),
      });
      appToast.success(next === "ACTIVE" ? "Connection enabled" : "Connection disabled");
      await load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to update connection");
    }
  };

  const rotateSecret = async (conn: Connection) => {
    if (!tenant) return;
    try {
      const result = await apiFetch<{ webhookSecret: string }>(
        `/integrations/connections/${conn.id}/rotate-secret`,
        { method: "POST", tenant },
      );
      setRevealedSecret(result.webhookSecret);
      appToast.success("Webhook secret rotated");
      await load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to rotate secret");
    }
  };

  const deleteConnection = (conn: Connection) => {
    ask({
      title: `Delete "${conn.name}"?`,
      description: "Webhook URL will stop working. Event history is removed.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        if (!tenant) return;
        await apiFetch(`/integrations/connections/${conn.id}`, {
          method: "DELETE",
          tenant,
        });
        appToast.success("Connection deleted");
        setRevealedSecret(null);
        if (selectedId === conn.id) setSelectedId("");
        await load();
      },
    });
  };

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      appToast.success(`${label} copied`);
    } catch {
      appToast.error("Copy failed");
    }
  };

  return (
    <div>
      {dialog}
      <Text fontSize="sm" color="fg.muted" mb={4}>
        Connect OTAs and partner systems via adapter registry, stored credentials, and signed
        webhooks. Channel manager sync builds on these connections.
      </Text>

      {revealedSecret && (
        <ContentCard mb={4} borderColor="orange.500">
          <Text fontWeight="semibold" mb={1}>
            Webhook secret (shown once)
          </Text>
          <Text fontSize="xs" fontFamily="mono" wordBreak="break-all" mb={2}>
            {revealedSecret}
          </Text>
          <Flex gap={2}>
            <Button size="xs" onClick={() => copyText("Secret", revealedSecret)}>
              Copy secret
            </Button>
            <Button size="xs" variant="outline" onClick={() => setRevealedSecret(null)}>
              Dismiss
            </Button>
          </Flex>
        </ContentCard>
      )}

      <Flex justify="space-between" align="center" mb={3}>
        <Text fontWeight="semibold">Connections</Text>
        <Button size="sm" colorPalette="blue" onClick={() => setDrawerOpen(true)}>
          + Add connection
        </Button>
      </Flex>

      <ContentCard mb={6}>
        {loading ? (
          <TableSkeleton rows={3} columns={5} />
        ) : connections.length === 0 ? (
          <EmptyState
            title="No integrations yet"
            description="Add a generic webhook or OTA inquiry connection to receive partner events."
            icon="🔌"
          />
        ) : (
          <TableScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Name</Table.ColumnHeader>
                  <Table.ColumnHeader>Adapter</Table.ColumnHeader>
                  <Table.ColumnHeader>Branch</Table.ColumnHeader>
                  <Table.ColumnHeader>Status</Table.ColumnHeader>
                  <Table.ColumnHeader>Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {connections.map((c) => (
                  <Table.Row
                    key={c.id}
                    bg={selectedId === c.id ? "bg.muted" : undefined}
                    cursor="pointer"
                    onClick={() => setSelectedId(c.id)}
                  >
                    <Table.Cell>{c.name}</Table.Cell>
                    <Table.Cell>{c.adapterName}</Table.Cell>
                    <Table.Cell>{c.branchName ?? "All branches"}</Table.Cell>
                    <Table.Cell>
                      <Badge colorPalette={c.status === "ACTIVE" ? "green" : "gray"}>
                        {c.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap={1} wrap="wrap" onClick={(e) => e.stopPropagation()}>
                        <Button size="xs" variant="outline" onClick={() => toggleStatus(c)}>
                          {c.status === "ACTIVE" ? "Disable" : "Enable"}
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => rotateSecret(c)}>
                          Rotate secret
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          colorPalette="red"
                          onClick={() => deleteConnection(c)}
                        >
                          Delete
                        </Button>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </TableScrollArea>
        )}
      </ContentCard>

      {selectedConnection && (
        <ContentCard mb={6}>
          <Text fontWeight="semibold" mb={2}>
            Webhook — {selectedConnection.name}
          </Text>
          <Stack gap={2} fontSize="sm">
            <Flex gap={2} align="center" wrap="wrap">
              <Text color="fg.muted" minW="100px">
                URL
              </Text>
              <Text fontFamily="mono" fontSize="xs" flex="1" wordBreak="break-all">
                {selectedConnection.webhookUrl}
              </Text>
              <Button
                size="xs"
                variant="outline"
                onClick={() => copyText("Webhook URL", selectedConnection.webhookUrl)}
              >
                Copy URL
              </Button>
            </Flex>
            <Flex gap={2} align="center">
              <Text color="fg.muted" minW="100px">
                Secret
              </Text>
              <Text fontFamily="mono">{selectedConnection.webhookSecretPreview}</Text>
              <Text fontSize="xs" color="fg.muted">
                Send header <code>X-Webhook-Secret</code>
              </Text>
            </Flex>
          </Stack>
        </ContentCard>
      )}

      <Text fontWeight="semibold" mb={2}>
        Recent webhook events
      </Text>
      <ContentCard mb={6}>
        {eventsLoading ? (
          <TableSkeleton rows={3} columns={4} />
        ) : !selectedId ? (
          <Text fontSize="sm" color="fg.muted">
            Select a connection to view events.
          </Text>
        ) : events.length === 0 ? (
          <EmptyState
            title="No events yet"
            description="POST JSON to the webhook URL with the secret header."
            icon="📨"
          />
        ) : (
          <TableScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Time</Table.ColumnHeader>
                  <Table.ColumnHeader>Event</Table.ColumnHeader>
                  <Table.ColumnHeader>Status</Table.ColumnHeader>
                  <Table.ColumnHeader>Error</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {events.map((ev) => (
                  <Table.Row key={ev.id}>
                    <Table.Cell fontSize="xs">
                      {new Date(ev.createdAt).toLocaleString()}
                    </Table.Cell>
                    <Table.Cell>{ev.eventType}</Table.Cell>
                    <Table.Cell>
                      <Badge
                        colorPalette={
                          ev.status === "PROCESSED"
                            ? "green"
                            : ev.status === "FAILED"
                              ? "red"
                              : "gray"
                        }
                      >
                        {ev.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell fontSize="xs" color="fg.muted">
                      {ev.errorMessage ?? "—"}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </TableScrollArea>
        )}
      </ContentCard>

      <Text fontWeight="semibold" mb={2}>
        Adapter registry
      </Text>
      <ContentCard>
        <Stack gap={3}>
          {adapters.map((a) => (
            <Box key={a.key} p={0}>
              <Text fontWeight="medium">
                {a.name}{" "}
                <Text as="span" fontSize="xs" color="fg.muted" fontFamily="mono">
                  ({a.key})
                </Text>
              </Text>
              <Text fontSize="sm" color="fg.muted">
                {a.description}
              </Text>
              <Text fontSize="xs" color="fg.muted" mt={1}>
                Events: {a.supportedEvents.join(", ")}
              </Text>
            </Box>
          ))}
        </Stack>
      </ContentCard>

      <FormDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setForm({ adapterKey: "generic_webhook", name: "", branchId: "", credentials: {} });
        }}
        title="Add integration connection"
        size="sm"
        primaryLabel="Create connection"
        onPrimary={createConnection}
        primaryLoading={saving}
        primaryDisabled={!form.name.trim()}
      >
        <Stack gap={4}>
          <FormField label="Adapter">
            <AppSelect
              items={adapters.map((a) => ({ value: a.key, label: a.name }))}
              value={form.adapterKey}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  adapterKey: v,
                  credentials: {},
                }))
              }
            />
          </FormField>
          <FormField label="Connection name">
            <Input
              size="sm"
              placeholder="Booking.com — Main"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>
          <FormField label="Branch (optional)">
            <AppSelect
              items={[
                { value: "", label: "Organization-wide" },
                ...branches.map((b) => ({ value: b.id, label: b.name })),
              ]}
              value={form.branchId}
              onChange={(v) => setForm((f) => ({ ...f, branchId: v }))}
            />
          </FormField>
          {selectedAdapter?.credentialFields.map((field) => (
            <FormField key={field.key} label={field.label}>
              <Input
                size="sm"
                type={field.secret ? "password" : "text"}
                value={form.credentials[field.key] ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    credentials: { ...f.credentials, [field.key]: e.target.value },
                  }))
                }
              />
            </FormField>
          ))}
        </Stack>
      </FormDrawer>
    </div>
  );
}
