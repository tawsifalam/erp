"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Table, Text } from "@chakra-ui/react";
import { ContentCard, TableSkeleton, TableScrollArea } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { appToast } from "@/lib/app-toast";
import type { TenantHeaders } from "@/lib/api-client";

type NotificationPreference = {
  type: string;
  label: string;
  description: string;
  inApp: boolean;
  email: boolean;
  isDefault: boolean;
};

export function NotificationPreferencesSection({
  tenant,
}: {
  tenant: TenantHeaders | undefined;
}) {
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<NotificationPreference[]>("/notifications/preferences", {
        tenant,
      });
      setPrefs(data);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load notification preferences");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    load();
  }, [load]);

  const updateChannel = async (
    type: string,
    channel: "inApp" | "email",
    enabled: boolean,
  ) => {
    if (!tenant) return;
    const current = prefs.find((p) => p.type === type);
    if (!current) return;

    const next = {
      inApp: channel === "inApp" ? enabled : current.inApp,
      email: channel === "email" ? enabled : current.email,
    };

    setSaving(type);
    setPrefs((rows) =>
      rows.map((p) =>
        p.type === type ? { ...p, inApp: next.inApp, email: next.email, isDefault: false } : p,
      ),
    );
    try {
      const updated = await apiFetch<NotificationPreference>(
        `/notifications/preferences/${type}`,
        {
          method: "PATCH",
          tenant,
          body: JSON.stringify(next),
        },
      );
      setPrefs((rows) => rows.map((p) => (p.type === type ? updated : p)));
      appToast.success("Notification preference saved");
    } catch (e) {
      setPrefs((rows) =>
        rows.map((p) => (p.type === type ? { ...current, isDefault: p.isDefault } : p)),
      );
      appToast.error(e instanceof Error ? e.message : "Failed to save preference");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Box>
      <Text fontSize="sm" color="fg.muted" mb={4}>
        Choose how you receive alerts for this organization. Preferences apply to your account
        only. Email requires{" "}
        <Text as="span" fontFamily="mono">
          RESEND_API_KEY
        </Text>{" "}
        in the API environment.
      </Text>

      <ContentCard>
        {loading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : (
          <TableScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Event</Table.ColumnHeader>
                  <Table.ColumnHeader>In-app</Table.ColumnHeader>
                  <Table.ColumnHeader>Email</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {prefs.map((pref) => (
                  <Table.Row key={pref.type}>
                    <Table.Cell>
                      <Text fontWeight="medium">{pref.label}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {pref.description}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <input
                        type="checkbox"
                        aria-label={`${pref.label} in-app`}
                        checked={pref.inApp}
                        disabled={saving === pref.type}
                        onChange={(e) => updateChannel(pref.type, "inApp", e.target.checked)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <input
                        type="checkbox"
                        aria-label={`${pref.label} email`}
                        checked={pref.email}
                        disabled={saving === pref.type}
                        onChange={(e) => updateChannel(pref.type, "email", e.target.checked)}
                      />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </TableScrollArea>
        )}
      </ContentCard>

      <Flex mt={3}>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </Flex>
    </Box>
  );
}
