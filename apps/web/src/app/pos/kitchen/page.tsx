"use client";

import { useEffect, useState } from "react";
import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { getSocket, joinKitchen } from "@/lib/socket";
import { useTenant } from "@/lib/tenant-context";
import { erpTheme } from "@erp/ui";

type Ticket = { id: string; orderId: string; status: string };

export default function KitchenPage() {
  const { branchId } = useTenant();
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    if (!branchId) return;
    const socket = getSocket();
    if (!socket) return;
    joinKitchen(branchId);
    socket.on("kitchen.ticket", (ticket: Ticket) => {
      setTickets((prev) => [ticket, ...prev]);
    });
    return () => {
      socket.off("kitchen.ticket");
    };
  }, [branchId]);

  return (
    <Box minH="100vh" bg={erpTheme.kitchen.bg} color={erpTheme.kitchen.text} p={6}>
      <Heading size="xl" mb={6} color={erpTheme.kitchen.accent}>
        Kitchen Display
      </Heading>
      <Stack gap={4}>
        {tickets.length === 0 && <Text>No active tickets</Text>}
        {tickets.map((t) => (
          <Box key={t.id} p={4} borderWidth="2px" borderColor={erpTheme.kitchen.accent} borderRadius="md">
            <Text fontSize="lg" fontWeight="bold">
              Order {t.orderId.slice(0, 8)}
            </Text>
            <Text>{t.status}</Text>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
