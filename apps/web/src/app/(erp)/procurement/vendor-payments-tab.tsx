"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Flex, Input, Stack, Table, Text } from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import { FormDrawer } from "@/components/form-drawer";
import { ContentCard, EmptyState, FormField, MoneyText, TableScrollArea } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/tenant-context";
import { appToast } from "@/lib/app-toast";
import { formatDateTime } from "@/lib/format";

type Vendor = { id: string; name: string };

type PurchaseOrder = {
  id: string;
  status: string;
  vendor: { id: string; name: string };
};

type VendorPayment = {
  id: string;
  amount: string;
  paymentDate: string;
  payFromAccountCode: string;
  reference: string | null;
  vendor: { name: string };
  purchaseOrder: { id: string; status: string } | null;
};

type ApBalance = { accrued: number; paid: number; balance: number };

export function VendorPaymentsTab({
  tenant,
  vendors,
  orders,
}: {
  tenant: TenantHeaders;
  vendors: Vendor[];
  orders: PurchaseOrder[];
}) {
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [balance, setBalance] = useState<ApBalance | null>(null);
  const [form, setForm] = useState({
    vendorId: "",
    purchaseOrderId: "",
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    payFromAccountCode: "1100",
    reference: "",
  });

  const loadPayments = useCallback(async () => {
    if (!tenant.branchId) return;
    const data = await apiFetch<VendorPayment[]>("/procurement/vendor-payments", { tenant });
    setPayments(data);
  }, [tenant]);

  useEffect(() => {
    loadPayments().catch((e) =>
      appToast.error(e instanceof Error ? e.message : "Failed to load payments"),
    );
  }, [loadPayments]);

  const loadBalance = useCallback(
    async (vendorId: string) => {
      if (!vendorId || !tenant.branchId) {
        setBalance(null);
        return;
      }
      const data = await apiFetch<ApBalance>(`/procurement/vendors/${vendorId}/ap-balance`, {
        tenant,
      });
      setBalance(data);
    },
    [tenant],
  );

  useEffect(() => {
    if (form.vendorId) loadBalance(form.vendorId);
    else setBalance(null);
  }, [form.vendorId, loadBalance]);

  const vendorOrders = orders.filter(
    (o) => o.vendor.id === form.vendorId && ["PARTIALLY_RECEIVED", "RECEIVED"].includes(o.status),
  );

  const recordPayment = async () => {
    if (!tenant.branchId) return;
    try {
      await apiFetch("/procurement/vendor-payments", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          vendorId: form.vendorId,
          amount: Number(form.amount),
          paymentDate: form.paymentDate,
          payFromAccountCode: form.payFromAccountCode,
          purchaseOrderId: form.purchaseOrderId || undefined,
          reference: form.reference || undefined,
        }),
      });
      appToast.success("Vendor payment recorded");
      setDrawerOpen(false);
      setForm({
        vendorId: "",
        purchaseOrderId: "",
        amount: "",
        paymentDate: new Date().toISOString().slice(0, 10),
        payFromAccountCode: "1100",
        reference: "",
      });
      setBalance(null);
      loadPayments();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to record payment");
    }
  };

  return (
    <>
      <Flex mb={3} gap={2} wrap="wrap">
        <Button size="sm" onClick={() => loadPayments()}>
          Refresh
        </Button>
        <Button
          size="sm"
          colorPalette="blue"
          onClick={() => setDrawerOpen(true)}
          disabled={!tenant.branchId || vendors.length === 0}
        >
          + Record payment
        </Button>
      </Flex>

      <ContentCard>
        {payments.length === 0 ? (
          <EmptyState
            title="No vendor payments"
            description="Record a payment after receiving goods to clear accounts payable (Dr AP / Cr Bank)."
          />
        ) : (
          <TableScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Date</Table.ColumnHeader>
                  <Table.ColumnHeader>Vendor</Table.ColumnHeader>
                  <Table.ColumnHeader>Amount</Table.ColumnHeader>
                  <Table.ColumnHeader>Paid from</Table.ColumnHeader>
                  <Table.ColumnHeader>PO</Table.ColumnHeader>
                  <Table.ColumnHeader>Reference</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {payments.map((p) => (
                  <Table.Row key={p.id}>
                    <Table.Cell whiteSpace="nowrap">
                      {formatDateTime(p.paymentDate)}
                    </Table.Cell>
                    <Table.Cell>{p.vendor.name}</Table.Cell>
                    <Table.Cell>
                      <MoneyText amount={Number(p.amount)} />
                    </Table.Cell>
                    <Table.Cell>{p.payFromAccountCode}</Table.Cell>
                    <Table.Cell fontFamily="mono" fontSize="xs">
                      {p.purchaseOrder?.id.slice(0, 8) ?? "—"}
                    </Table.Cell>
                    <Table.Cell>{p.reference ?? "—"}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </TableScrollArea>
        )}
      </ContentCard>

      <FormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Record vendor payment"
        primaryLabel="Record payment"
        onPrimary={recordPayment}
        primaryDisabled={!form.vendorId || !form.amount || Number(form.amount) <= 0}
      >
        <Stack gap={4}>
          <FormField label="Vendor" required>
            <AppSelect
              width="100%"
              items={vendors.map((v) => ({ value: v.id, label: v.name }))}
              value={form.vendorId}
              onValueChange={(v) =>
                setForm({ ...form, vendorId: v, purchaseOrderId: "", amount: "" })
              }
              placeholder="Select vendor"
            />
          </FormField>
          {balance && (
            <Text fontSize="sm" color="fg.muted">
              Accrued AP: {balance.accrued.toLocaleString()} · Paid: {balance.paid.toLocaleString()}{" "}
              · Outstanding:{" "}
              <Text as="span" fontWeight="semibold">
                {balance.balance.toLocaleString()}
              </Text>
            </Text>
          )}
          <FormField label="Purchase order (optional)">
            <AppSelect
              width="100%"
              items={[
                { value: "", label: "— None —" },
                ...vendorOrders.map((o) => ({
                  value: o.id,
                  label: `${o.id.slice(0, 8)}… (${o.status})`,
                })),
              ]}
              value={form.purchaseOrderId}
              onValueChange={(v) => setForm({ ...form, purchaseOrderId: v })}
              placeholder="Link to PO"
            />
          </FormField>
          <FormField label="Amount" required>
            <Input
              size="sm"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </FormField>
          <FormField label="Payment date" required>
            <Input
              size="sm"
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
            />
          </FormField>
          <FormField label="Pay from account" required>
            <AppSelect
              width="100%"
              items={[
                { value: "1100", label: "1100 — Bank Account" },
                { value: "1000", label: "1000 — Cash" },
              ]}
              value={form.payFromAccountCode}
              onValueChange={(v) => setForm({ ...form, payFromAccountCode: v })}
            />
          </FormField>
          <FormField label="Reference">
            <Input
              size="sm"
              placeholder="Check #, transfer ref"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </FormField>
        </Stack>
      </FormDrawer>
    </>
  );
}
