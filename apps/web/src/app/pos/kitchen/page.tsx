"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Heading, Link, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { getSocket, joinKitchen } from "@/lib/socket";
import { useTenantHeaders } from "@/lib/tenant-context";
import { apiFetch } from "@/lib/api-client";
import { erpTheme, EmptyState } from "@erp/ui";
import { shortId } from "@/lib/format";
import type { Order } from "@/lib/pos-types";

type KitchenCard = {
  id: string;
  orderId: string;
  status: string;
  order?: Order;
};

export default function KitchenPage() {
  const tenant = useTenantHeaders();
  const [cards, setCards] = useState<KitchenCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(() => {
    if (!tenant.branchId) return;
    apiFetch<Order[]>(`/pos/orders?branchId=${tenant.branchId}`, { tenant })
      .then((orders) => {
        const active = orders.filter((o) =>
          ["SUBMITTED", "PREPARING", "READY"].includes(o.status),
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
  }, [tenant.branchId, tenant.organizationId]);

  useEffect(loadOrders, [loadOrders]);

  useEffect(() => {
    if (!tenant.branchId) return;
    const socket = getSocket();
    if (!socket) return;
    joinKitchen(tenant.branchId);
    const refresh = () => loadOrders();
    socket.on("kitchen.ticket", refresh);
    socket.on("order.updated", refresh);
    return () => {
      socket.off("kitchen.ticket", refresh);
      socket.off("order.updated", refresh);
    };
  }, [tenant.branchId, loadOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    try {
      await apiFetch(`/pos/orders/${orderId}/status?branchId=${tenant.branchId}`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify({ status }),
      });
      loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  return (
    <Box minH="100vh" bg={erpTheme.kitchen.bg} color={erpTheme.kitchen.text} p={6}>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="xl" color={erpTheme.kitchen.accent}>
          Kitchen Display
        </Heading>
        <Link asChild color={erpTheme.kitchen.accent}>
          <NextLink href="/pos">← Back to POS</NextLink>
        </Link>
      </Flex>

      {error && (
        <Text color="red.300" mb={3} fontSize="sm">
          {error}
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
