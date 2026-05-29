"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Flex, Heading, Link, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { getSocket, joinKitchen } from "@/lib/socket";
import { useTenant, useTenantHeaders } from "@/lib/tenant-context";
import { getBranchesForOrg } from "@/lib/tenant";
import { apiFetch } from "@/lib/api-client";
import { erpTheme, EmptyState } from "@erp/ui";
import { TenantSelector } from "@/components/tenant-selector";
import { shortId } from "@/lib/format";
import type { Order } from "@/lib/pos-types";

type KitchenCard = {
  id: string;
  orderId: string;
  status: string;
  order?: Order;
};

const ACTIVE_STATUSES = ["SUBMITTED", "PREPARING", "READY"];

export default function KitchenPage() {
  const tenant = useTenant();
  const headers = useTenantHeaders();
  const [cards, setCards] = useState<KitchenCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  const branchName = useMemo(() => {
    if (!tenant.organizationId || !tenant.branchId) return null;
    return getBranchesForOrg(tenant.memberships, tenant.organizationId).find(
      (b) => b.id === tenant.branchId,
    )?.name;
  }, [tenant.organizationId, tenant.branchId, tenant.memberships]);

  const loadOrders = useCallback(() => {
    if (!headers.branchId) return;
    apiFetch<Order[]>(`/pos/orders?branchId=${headers.branchId}`, { tenant: headers })
      .then((orders) => {
        const active = orders
          .filter((o) => ACTIVE_STATUSES.includes(o.status))
          .sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        setCards(
          active.map((o) => ({
            id: o.id,
            orderId: o.id,
            status: o.status,
            order: o,
          })),
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load queue"));
  }, [headers.branchId, headers.organizationId]);

  useEffect(loadOrders, [loadOrders]);

  useEffect(() => {
    if (!headers.branchId) return;
    const socket = getSocket();
    if (!socket) return;
    joinKitchen(headers.branchId);
    const refresh = () => loadOrders();
    socket.on("kitchen.ticket", refresh);
    socket.on("order.updated", refresh);
    return () => {
      socket.off("kitchen.ticket", refresh);
      socket.off("order.updated", refresh);
    };
  }, [headers.branchId, loadOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    try {
      await apiFetch(`/pos/orders/${orderId}/status?branchId=${headers.branchId}`, {
        method: "PATCH",
        tenant: headers,
        body: JSON.stringify({ status }),
      });
      loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  return (
    <Box minH="100vh" bg={erpTheme.kitchen.bg} color={erpTheme.kitchen.text} p={6}>
      <Flex justify="space-between" align="flex-start" mb={6} gap={4} wrap="wrap">
        <Box>
          <Heading size="xl" color={erpTheme.kitchen.accent}>
            Kitchen Display
          </Heading>
          {branchName && (
            <Text fontSize="sm" color="fg.muted" mt={1}>
              {branchName}
            </Text>
          )}
        </Box>
        <Flex gap={4} align="center" wrap="wrap">
          <TenantSelector />
          <Link asChild color={erpTheme.kitchen.accent}>
            <NextLink href="/pos">← Back to POS</NextLink>
          </Link>
        </Flex>
      </Flex>

      {error && (
        <Text color="red.300" mb={3} fontSize="sm">
          {error}
        </Text>
      )}

      {!headers.branchId && (
        <Text color="orange.200" mb={3} fontSize="sm">
          Select a branch above to load the kitchen queue.
        </Text>
      )}

      <Button size="sm" mb={4} variant="surface" onClick={loadOrders}>
        Refresh queue
      </Button>

      <Stack gap={4}>
        {cards.length === 0 && (
          <EmptyState message="No active kitchen tickets. Submit an order from POS." />
        )}
        {cards.map((t) => (
          <Box
            key={t.id}
            p={4}
            borderWidth="2px"
            borderColor={erpTheme.kitchen.accent}
            borderRadius="md"
          >
            <Text fontSize="lg" fontWeight="bold" mb={1}>
              Order {shortId(t.orderId)}
              {t.order?.tableNumber ? ` · Table ${t.order.tableNumber}` : ""}
            </Text>
            <Text mb={1}>{t.status}</Text>
            {t.order?.notes && (
              <Text fontSize="sm" color="orange.200" mb={2}>
                Note: {t.order.notes}
              </Text>
            )}
            {t.order?.lines && (
              <Stack gap={1} mb={3} fontSize="sm">
                {t.order.lines.map((l, i) => (
                  <Text key={i}>
                    {l.quantity}× {l.menuItem.name}
                  </Text>
                ))}
              </Stack>
            )}
            <Flex gap={2}>
              {t.status === "SUBMITTED" && (
                <Button
                  size="sm"
                  colorPalette="yellow"
                  onClick={() => updateStatus(t.orderId, "PREPARING")}
                >
                  Start prep
                </Button>
              )}
              {t.status === "PREPARING" && (
                <Button
                  size="sm"
                  colorPalette="green"
                  onClick={() => updateStatus(t.orderId, "READY")}
                >
                  Mark ready
                </Button>
              )}
              {t.status === "READY" && (
                <Text fontSize="sm" color="fg.muted">
                  Ready — complete payment on POS
                </Text>
              )}
            </Flex>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
