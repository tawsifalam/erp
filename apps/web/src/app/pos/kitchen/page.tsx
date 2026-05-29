"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Heading, Link, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { getSocket, joinKitchen } from "@/lib/socket";
import { useTenantHeaders } from "@/lib/tenant-context";
import { apiFetch } from "@/lib/api-client";
import { erpTheme, EmptyState } from "@erp/ui";
import { shortId } from "@/lib/format";

type Order = {
  id: string;
  status: string;
  tableNumber?: string;
  lines: { quantity: number; menuItem: { name: string } }[];
};

type KitchenCard = {
  id: string;
  orderId: string;
  status: string;
  order?: Order;
};

export default function KitchenPage() {
  const tenant = useTenantHeaders();
  const [cards, setCards] = useState<KitchenCard[]>([]);

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
      .catch(console.error);
  }, [tenant.branchId, tenant.organizationId]);

  useEffect(loadOrders, [loadOrders]);

  useEffect(() => {
    if (!tenant.branchId) return;
    const socket = getSocket();
    if (!socket) return;
    joinKitchen(tenant.branchId);
    socket.on("kitchen.ticket", () => {
      loadOrders();
    });
    return () => {
      socket.off("kitchen.ticket");
    };
  }, [tenant.branchId, loadOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    await apiFetch(`/pos/orders/${orderId}/status?branchId=${tenant.branchId}`, {
      method: "PATCH",
      tenant,
      body: JSON.stringify({ status }),
    });
    loadOrders();
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
            <Text mb={2}>{t.status}</Text>
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
            </Flex>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
