"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  Link,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import NextLink from "next/link";
import { BranchRequiredNotice } from "@/components/branch-required-notice";
import { EmptyState, FormField, MoneyText, StatusBadge, TableSkeleton } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { CartItem, MenuCategory, Order } from "@/lib/pos-types";
import { appToast } from "@/lib/app-toast";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";

export function OrdersTab({ tenant }: { tenant: TenantHeaders }) {
  const { ask, dialog } = useConfirmDialog();
  const branchId = tenant.branchId;
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") {
      return !["COMPLETED", "CANCELLED"].includes(o.status);
    }
    return o.status === statusFilter;
  });

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const [orderList, menu] = await Promise.all([
        apiFetch<Order[]>(`/pos/orders?branchId=${branchId}`, { tenant }),
        apiFetch<MenuCategory[]>(`/pos/menu/categories?branchId=${branchId}`, { tenant }),
      ]);
      setOrders(orderList);
      setCategories(menu);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [branchId, tenant.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const addToCart = (item: { id: string; name: string; price: string }) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [
        ...prev,
        { menuItemId: item.id, name: item.name, quantity: 1, unitPrice: Number(item.price) },
      ];
    });
  };

  const adjustCartQty = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + delta } : c,
        )
        .filter((c) => c.quantity > 0),
    );
  };

  const cartTotal = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);

  const handleCreateOrder = async () => {
    if (!branchId || cart.length === 0) return;
    try {
      await apiFetch("/pos/orders", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          branchId,
          tableNumber: tableNumber || undefined,
          notes: notes || undefined,
          lines: cart.map((c) => ({
            menuItemId: c.menuItemId,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
          })),
        }),
      });
      setCart([]);
      setTableNumber("");
      setNotes("");
      setShowNewOrder(false);
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to create order");
    }
  };

  const handleSubmit = async (orderId: string) => {
    try {
      await apiFetch(`/pos/orders/${orderId}/submit?branchId=${branchId}`, {
        method: "POST",
        tenant,
      });
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to submit order");
    }
  };

  const openPayment = (order: Order) => {
    setPaymentId(order.id);
    setPaymentAmount(String(order.totalAmount));
  };

  const savePayment = async () => {
    if (!branchId || !paymentId) return;
    try {
      await apiFetch(`/pos/orders/${paymentId}/complete?branchId=${branchId}`, {
        method: "POST",
        tenant,
        body: JSON.stringify({ paidAmount: Number(paymentAmount) }),
      });
      setPaymentId(null);
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to complete order");
    }
  };

  const doCancel = async (orderId: string) => {
    try {
      await apiFetch(`/pos/orders/${orderId}/cancel?branchId=${branchId}`, {
        method: "POST",
        tenant,
      });
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Cannot cancel order");
    }
  };

  const confirmCancel = (orderId: string) => {
    ask({
      title: "Cancel order?",
      description: "This order will be marked as cancelled.",
      confirmLabel: "Cancel order",
      onConfirm: () => doCancel(orderId),
    });
  };

  const doDelete = async (orderId: string) => {
    try {
      await apiFetch(`/pos/orders/${orderId}?branchId=${branchId}`, {
        method: "DELETE",
        tenant,
      });
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Cannot delete order");
    }
  };

  const confirmDelete = (orderId: string) => {
    ask({
      title: "Delete order?",
      description: "This order record will be permanently removed.",
      confirmLabel: "Delete",
      onConfirm: () => doDelete(orderId),
    });
  };

  if (!branchId) {
    return <BranchRequiredNotice />;
  }

  return (
    <>
      {dialog}
      <Box>

      <Flex gap={2} mb={4} wrap="wrap" align="center">
        <Button size="sm" onClick={load}>
          Refresh
        </Button>
        <Button size="sm" colorPalette="blue" onClick={() => setShowNewOrder(!showNewOrder)}>
          {showNewOrder ? "Cancel" : "+ New Order"}
        </Button>
        <AppSelect
          width="160px"
          items={[
            { value: "active", label: "Active orders" },
            { value: "all", label: "All orders" },
            { value: "DRAFT", label: "Draft" },
            { value: "SUBMITTED", label: "Submitted" },
            { value: "PREPARING", label: "Preparing" },
            { value: "READY", label: "Ready" },
            { value: "COMPLETED", label: "Completed" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
          value={statusFilter}
          onValueChange={setStatusFilter}
        />
        <Link asChild fontSize="sm" color="blue.600">
          <NextLink href="/accounting">View journals →</NextLink>
        </Link>
      </Flex>

      {showNewOrder && (
        <Box bg="white" borderRadius="md" p={4} mb={4}>
          <Flex gap={6} wrap="wrap">
            <Box flex="1" minW="300px">
              <Text fontWeight="semibold" mb={2}>
                Menu
              </Text>
              {categories.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  Add menu items on the Menu tab first.
                </Text>
              ) : (
                categories.map((cat) => (
                  <Box key={cat.id} mb={3}>
                    <Text fontSize="sm" fontWeight="medium" color="fg.muted" mb={1}>
                      {cat.name}
                    </Text>
                    <Flex gap={2} wrap="wrap">
                      {cat.items.filter((item) => item.isActive !== false).map((item) => (
                        <Button
                          key={item.id}
                          size="xs"
                          variant="outline"
                          onClick={() => addToCart(item)}
                        >
                          {item.name} (৳{Number(item.price)})
                        </Button>
                      ))}
                    </Flex>
                  </Box>
                ))
              )}
            </Box>
            <Box w="300px">
              <Text fontWeight="semibold" mb={2}>
                Cart
              </Text>
              <FormField label="Table number" help="Optional — for dine-in orders.">
                <Input
                  size="sm"
                  placeholder="Table #"
                  mb={2}
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                />
              </FormField>
              <FormField label="Notes" help="Allergies, special requests, etc.">
                <Input
                  size="sm"
                  placeholder="Notes (allergies, etc.)"
                  mb={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </FormField>
              {cart.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  Add items from the menu
                </Text>
              ) : (
                <Stack gap={1}>
                  {cart.map((c) => (
                    <Flex key={c.menuItemId} justify="space-between" align="center" fontSize="sm">
                      <Text>
                        {c.name} ×{c.quantity}
                      </Text>
                      <Flex gap={1} align="center">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => adjustCartQty(c.menuItemId, -1)}
                        >
                          −
                        </Button>
                        <Text>৳{c.quantity * c.unitPrice}</Text>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => adjustCartQty(c.menuItemId, 1)}
                        >
                          +
                        </Button>
                      </Flex>
                    </Flex>
                  ))}
                  <Flex justify="space-between" fontWeight="bold" borderTopWidth="1px" pt={2} mt={1}>
                    <Text>Total</Text>
                    <Text>৳{cartTotal}</Text>
                  </Flex>
                  <Button
                    size="sm"
                    colorPalette="green"
                    mt={2}
                    onClick={handleCreateOrder}
                    disabled={cart.length === 0}
                  >
                    Create Order
                  </Button>
                </Stack>
              )}
            </Box>
          </Flex>
        </Box>
      )}

      <Box bg="white" borderRadius="md" p={4}>
        {loading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : (
          <>
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
              {filteredOrders.map((o) => (
                <Table.Row key={o.id}>
                  <Table.Cell>{o.tableNumber ?? "—"}</Table.Cell>
                  <Table.Cell fontSize="xs">
                    {o.lines.map((l) => `${l.menuItem.name}×${l.quantity}`).join(", ")}
                  </Table.Cell>
                  <Table.Cell>
                    <MoneyText amount={Number(o.totalAmount)} />
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={o.status} />
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={o.paymentStatus} />
                  </Table.Cell>
                  <Table.Cell>
                    <Flex gap={1} wrap="wrap">
                      {o.status === "DRAFT" && (
                        <>
                          <Button size="xs" colorPalette="blue" onClick={() => handleSubmit(o.id)}>
                            Send to Kitchen
                          </Button>
                          <Button
                            size="xs"
                            colorPalette="red"
                            variant="outline"
                            onClick={() => confirmCancel(o.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                      {(o.status === "SUBMITTED" ||
                        o.status === "PREPARING" ||
                        o.status === "READY") && (
                        <>
                          <Button size="xs" colorPalette="green" onClick={() => openPayment(o)}>
                            Complete & Pay
                          </Button>
                          {o.status === "SUBMITTED" && (
                            <Button
                              size="xs"
                              colorPalette="red"
                              variant="outline"
                              onClick={() => confirmCancel(o.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </>
                      )}
                      {(o.status === "DRAFT" || o.status === "CANCELLED") && (
                        <Button
                          size="xs"
                          colorPalette="red"
                          variant="outline"
                          onClick={() => confirmDelete(o.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          {filteredOrders.length === 0 && (
            <EmptyState message="No orders match this filter." />
          )}
          </>
        )}
      </Box>

      {paymentId && (
        <Box
          position="fixed"
          inset={0}
          bg="blackAlpha.400"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={10}
        >
          <Box bg="white" p={6} borderRadius="md" minW="300px">
            <Text fontWeight="semibold" mb={3}>
              Complete & pay
            </Text>
            <Text fontSize="sm" color="fg.muted" mb={2}>
              Enter amount received (defaults to full total).
            </Text>
            <Input
              size="sm"
              type="number"
              mb={3}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <Flex gap={2}>
              <Button size="sm" colorPalette="green" onClick={savePayment}>
                Complete
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPaymentId(null)}>
                Cancel
              </Button>
            </Flex>
          </Box>
        </Box>
      )}
    </Box>
    </>
  );
}
