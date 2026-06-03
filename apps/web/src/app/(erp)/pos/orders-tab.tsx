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
import { AppNumberInput } from "@/components/app-number-input";
import { FormDialog } from "@/components/form-dialog";
import { FormDrawer } from "@/components/form-drawer";
import { RowActionsMenu } from "@/components/row-actions-menu";
import NextLink from "next/link";
import { BranchRequiredNotice } from "@/components/branch-required-notice";
import {
  ContentCard,
  EmptyState,
  FormField,
  MoneyText,
  StatusBadge,
  TableScrollArea,
  TableSkeleton,
} from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { CartItem, MenuCategory, Order } from "@/lib/pos-types";
import type { Reservation } from "@/lib/pms-types";
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
  const [reservationId, setReservationId] = useState("");
  const [checkedInReservations, setCheckedInReservations] = useState<Reservation[]>([]);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
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
      const [orderList, menu, reservations] = await Promise.all([
        apiFetch<Order[]>(`/pos/orders?branchId=${branchId}`, { tenant }),
        apiFetch<MenuCategory[]>(`/pos/menu/categories?branchId=${branchId}`, { tenant }),
        apiFetch<Reservation[]>(`/pms/reservations?branchId=${branchId}`, { tenant }),
      ]);
      setOrders(orderList);
      setCategories(menu);
      setCheckedInReservations(reservations.filter((r) => r.status === "CHECKED_IN"));
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [branchId, tenant.organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetNewOrder = () => {
    setCart([]);
    setTableNumber("");
    setNotes("");
    setReservationId("");
  };

  const closeNewOrder = () => {
    setNewOrderOpen(false);
    resetNewOrder();
  };

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
          reservationId: reservationId || undefined,
          lines: cart.map((c) => ({
            menuItemId: c.menuItemId,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
          })),
        }),
      });
      closeNewOrder();
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

  const closePayment = () => {
    setPaymentId(null);
    setPaymentAmount("");
  };

  const savePayment = async () => {
    if (!branchId || !paymentId) return;
    try {
      await apiFetch(`/pos/orders/${paymentId}/complete?branchId=${branchId}`, {
        method: "POST",
        tenant,
        body: JSON.stringify({ paidAmount: Number(paymentAmount) }),
      });
      closePayment();
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

  const orderRowActions = (o: Order) => {
    const items: { label: string; onClick: () => void; colorPalette?: string }[] = [];
    if (o.status === "DRAFT") {
      items.push({ label: "Cancel", onClick: () => confirmCancel(o.id) });
      items.push({
        label: "Delete",
        onClick: () => confirmDelete(o.id),
        colorPalette: "red",
      });
    }
    if (o.status === "SUBMITTED") {
      items.push({ label: "Cancel", onClick: () => confirmCancel(o.id) });
    }
    if (o.status === "CANCELLED") {
      items.push({
        label: "Delete",
        onClick: () => confirmDelete(o.id),
        colorPalette: "red",
      });
    }
    return items;
  };

  if (!branchId) {
    return <BranchRequiredNotice />;
  }

  return (
    <>
      {dialog}
      <Flex gap={2} mb={4} wrap="wrap" align="center">
        <Button size="sm" onClick={load}>
          Refresh
        </Button>
        <Button
          size="sm"
          colorPalette="blue"
          w={{ base: "full", sm: "auto" }}
          onClick={() => setNewOrderOpen(true)}
        >
          + New order
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

      <ContentCard p={0} overflow="hidden">
        {loading ? (
          <Box p={4}>
            <TableSkeleton rows={5} columns={6} />
          </Box>
        ) : (
          <>
            <TableScrollArea>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Table</Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: "none", sm: "table-cell" }}>
                      Items
                    </Table.ColumnHeader>
                    <Table.ColumnHeader>Total</Table.ColumnHeader>
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: "none", md: "table-cell" }}>
                      Payment
                    </Table.ColumnHeader>
                    <Table.ColumnHeader>Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {filteredOrders.map((o) => (
                    <Table.Row key={o.id}>
                      <Table.Cell>{o.tableNumber ?? "—"}</Table.Cell>
                      <Table.Cell fontSize="xs" display={{ base: "none", sm: "table-cell" }}>
                        {o.lines.map((l) => `${l.menuItem.name}×${l.quantity}`).join(", ")}
                      </Table.Cell>
                      <Table.Cell>
                        <MoneyText amount={Number(o.totalAmount)} />
                      </Table.Cell>
                      <Table.Cell>
                        <StatusBadge status={o.status} />
                      </Table.Cell>
                      <Table.Cell display={{ base: "none", md: "table-cell" }}>
                        <StatusBadge status={o.paymentStatus} />
                      </Table.Cell>
                      <Table.Cell>
                        <Flex gap={1} wrap="wrap" align="center">
                          {o.status === "DRAFT" && (
                            <Button
                              size="xs"
                              colorPalette="blue"
                              onClick={() => handleSubmit(o.id)}
                            >
                              Send to kitchen
                            </Button>
                          )}
                          {(o.status === "SUBMITTED" ||
                            o.status === "PREPARING" ||
                            o.status === "READY") && (
                            <Button size="xs" colorPalette="green" onClick={() => openPayment(o)}>
                              Complete & pay
                            </Button>
                          )}
                          <RowActionsMenu items={orderRowActions(o)} />
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </TableScrollArea>
            {filteredOrders.length === 0 && (
              <Box p={4}>
                <EmptyState message="No orders match this filter." />
              </Box>
            )}
          </>
        )}
      </ContentCard>

      <FormDrawer
        open={newOrderOpen}
        onClose={closeNewOrder}
        title="New order"
        description="Add menu items to the cart, then create the order."
        size="lg"
        primaryLabel="Create order"
        onPrimary={handleCreateOrder}
        primaryDisabled={cart.length === 0}
      >
        <Stack gap={6}>
          <Box>
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
                    {cat.items
                      .filter((item) => item.isActive !== false)
                      .map((item) => (
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
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Cart
            </Text>
            <Stack gap={3}>
              <FormField label="Table number" help="Optional — for dine-in orders.">
                <Input
                  size="sm"
                  width="100%"
                  placeholder="Table #"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                />
              </FormField>
              <FormField label="Notes" help="Allergies, special requests, etc.">
                <Input
                  size="sm"
                  width="100%"
                  placeholder="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </FormField>
              <FormField
                label="Charge to room"
                help="Optional — posts comp meals to guest allowance on complete."
              >
                <AppSelect
                  width="100%"
                  items={[
                    { value: "", label: "No room charge" },
                    ...checkedInReservations.map((r) => ({
                      value: r.id,
                      label: `${r.room.roomNumber} — ${r.guest.fullName}`,
                    })),
                  ]}
                  value={reservationId}
                  onValueChange={setReservationId}
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
                  <Flex
                    justify="space-between"
                    fontWeight="bold"
                    borderTopWidth="1px"
                    pt={2}
                    mt={1}
                  >
                    <Text>Total</Text>
                    <Text>৳{cartTotal}</Text>
                  </Flex>
                </Stack>
              )}
            </Stack>
          </Box>
        </Stack>
      </FormDrawer>

      <FormDialog
        open={!!paymentId}
        onClose={closePayment}
        title="Complete & pay"
        primaryLabel="Complete"
        onPrimary={savePayment}
      >
        <Text fontSize="sm" color="fg.muted" mb={3}>
          Enter amount received (defaults to full total).
        </Text>
        <FormField label="Paid amount">
          <AppNumberInput
            min={0}
            value={paymentAmount}
            onValueChange={setPaymentAmount}
          />
        </FormField>
      </FormDialog>
    </>
  );
}
