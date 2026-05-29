"use client";

import { useEffect, useState, useCallback } from "react";
import { Box, Button, Table, Text, Input, Flex, Stack, NativeSelect } from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader, StatusBadge, MoneyText } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";

type MenuItem = { id: string; name: string; price: string };
type Category = { id: string; name: string; items: MenuItem[] };
type OrderLine = { id: string; quantity: number; unitPrice: string; lineTotal: string; menuItem: { name: string } };
type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  tableNumber?: string;
  createdAt: string;
  lines: OrderLine[];
};

type CartItem = { menuItemId: string; name: string; quantity: number; unitPrice: number };

export default function PosPage() {
  const tenant = useTenantHeaders();
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [showNewOrder, setShowNewOrder] = useState(false);

  const load = useCallback(() => {
    if (!tenant.branchId) return;
    apiFetch<Order[]>(`/pos/orders?branchId=${tenant.branchId}`, { tenant }).then(setOrders).catch(console.error);
    apiFetch<Category[]>(`/pos/menu/categories?branchId=${tenant.branchId}`, { tenant }).then(setCategories).catch(console.error);
  }, [tenant.branchId, tenant.organizationId]);

  useEffect(load, [load]);

  const allMenuItems = categories.flatMap((c) => c.items);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) return prev.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, quantity: 1, unitPrice: Number(item.price) }];
    });
  };

  const removeFromCart = (menuItemId: string) => {
    setCart((prev) => prev.filter((c) => c.menuItemId !== menuItemId));
  };

  const cartTotal = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);

  const handleCreateOrder = async () => {
    if (cart.length === 0) return;
    await apiFetch("/pos/orders", {
      method: "POST",
      tenant,
      body: JSON.stringify({
        branchId: tenant.branchId,
        tableNumber: tableNumber || undefined,
        lines: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity, unitPrice: c.unitPrice })),
      }),
    });
    setCart([]);
    setTableNumber("");
    setShowNewOrder(false);
    load();
  };

  const handleSubmit = async (orderId: string) => {
    await apiFetch(`/pos/orders/${orderId}/submit`, { method: "POST", tenant });
    load();
  };

  const handleComplete = async (orderId: string) => {
    await apiFetch(`/pos/orders/${orderId}/complete`, { method: "POST", tenant, body: JSON.stringify({}) });
    load();
  };

  return (
    <DashboardShell title="POS">
      <PageHeader title="Point of Sale" description="Orders & Cashier" />
      <Flex gap={2} mb={4}>
        <Button size="sm" onClick={load}>Refresh</Button>
        <Button size="sm" colorPalette="blue" onClick={() => setShowNewOrder(!showNewOrder)}>
          {showNewOrder ? "Cancel" : "+ New Order"}
        </Button>
      </Flex>

      {showNewOrder && (
        <Box bg="white" borderRadius="md" p={4} mb={4}>
          <Flex gap={6} wrap="wrap">
            <Box flex="1" minW="300px">
              <Text fontWeight="semibold" mb={2}>Menu</Text>
              {categories.map((cat) => (
                <Box key={cat.id} mb={3}>
                  <Text fontSize="sm" fontWeight="medium" color="fg.muted" mb={1}>{cat.name}</Text>
                  <Flex gap={2} wrap="wrap">
                    {cat.items.map((item) => (
                      <Button key={item.id} size="xs" variant="outline" onClick={() => addToCart(item)}>
                        {item.name} (৳{Number(item.price)})
                      </Button>
                    ))}
                  </Flex>
                </Box>
              ))}
            </Box>
            <Box w="280px">
              <Text fontWeight="semibold" mb={2}>Cart</Text>
              <Input size="sm" placeholder="Table #" mb={2} value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} />
              {cart.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">Add items from the menu</Text>
              ) : (
                <Stack gap={1}>
                  {cart.map((c) => (
                    <Flex key={c.menuItemId} justify="space-between" align="center" fontSize="sm">
                      <Text>{c.name} x{c.quantity}</Text>
                      <Flex gap={1} align="center">
                        <Text>৳{c.quantity * c.unitPrice}</Text>
                        <Button size="xs" variant="ghost" colorPalette="red" onClick={() => removeFromCart(c.menuItemId)}>×</Button>
                      </Flex>
                    </Flex>
                  ))}
                  <Flex justify="space-between" fontWeight="bold" borderTopWidth="1px" pt={2} mt={1}>
                    <Text>Total</Text>
                    <Text>৳{cartTotal}</Text>
                  </Flex>
                  <Button size="sm" colorPalette="green" mt={2} onClick={handleCreateOrder}>Create Order</Button>
                </Stack>
              )}
            </Box>
          </Flex>
        </Box>
      )}

      <Box bg="white" borderRadius="md" p={4}>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Table</Table.ColumnHeader>
              <Table.ColumnHeader>Items</Table.ColumnHeader>
              <Table.ColumnHeader>Total</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader>Payment</Table.ColumnHeader>
              <Table.ColumnHeader>Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {orders.map((o) => (
              <Table.Row key={o.id}>
                <Table.Cell>{o.tableNumber ?? "—"}</Table.Cell>
                <Table.Cell fontSize="xs">{o.lines.map((l) => `${l.menuItem.name}×${l.quantity}`).join(", ")}</Table.Cell>
                <Table.Cell><MoneyText amount={Number(o.totalAmount)} /></Table.Cell>
                <Table.Cell><StatusBadge status={o.status} /></Table.Cell>
                <Table.Cell><StatusBadge status={o.paymentStatus} /></Table.Cell>
                <Table.Cell>
                  <Flex gap={1}>
                    {o.status === "DRAFT" && (
                      <Button size="xs" colorPalette="blue" onClick={() => handleSubmit(o.id)}>Send to Kitchen</Button>
                    )}
                    {(o.status === "SUBMITTED" || o.status === "PREPARING" || o.status === "READY") && (
                      <Button size="xs" colorPalette="green" onClick={() => handleComplete(o.id)}>Complete & Pay</Button>
                    )}
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {orders.length === 0 && (
          <Text color="fg.muted" py={4}>No orders yet. Create one above.</Text>
        )}
      </Box>
    </DashboardShell>
  );
}
