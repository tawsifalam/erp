"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Flex,
  Input,
  Stack,
  Table,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { AppNumberInput } from "@/components/app-number-input";
import { AppSelect } from "@/components/app-select";
import { BranchRequiredNotice } from "@/components/branch-required-notice";
import { FormDrawer } from "@/components/form-drawer";
import { ModulePageHeader } from "@/components/module-page-header";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  ContentCard,
  EmptyState,
  FormField,
  TableScrollArea,
} from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";
import { appToast } from "@/lib/app-toast";
import { VendorPaymentsTab } from "./vendor-payments-tab";

type Vendor = {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
};

type InventoryItem = { id: string; sku: string; name: string };

type PoLine = {
  id: string;
  quantity: string;
  unitPrice: string;
  receivedQty: string;
  inventoryItem: InventoryItem;
};

type PurchaseOrder = {
  id: string;
  status: string;
  vendor: { id: string; name: string };
  lines: PoLine[];
};

export default function ProcurementPage() {
  const tenant = useTenantHeaders();
  const [tab, setTab] = useState("vendors");

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);

  const [vendorDrawer, setVendorDrawer] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: "", contactName: "", email: "" });

  const [poDrawer, setPoDrawer] = useState(false);
  const [poForm, setPoForm] = useState({
    vendorId: "",
    inventoryItemId: "",
    quantity: "",
    unitPrice: "",
  });

  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null);
  const [receiveLineId, setReceiveLineId] = useState("");
  const [receiveQty, setReceiveQty] = useState("");

  const loadVendors = useCallback(async () => {
    const data = await apiFetch<Vendor[]>("/procurement/vendors", { tenant });
    setVendors(data);
  }, [tenant]);

  const loadOrders = useCallback(async () => {
    if (!tenant.branchId) return;
    const data = await apiFetch<PurchaseOrder[]>("/procurement/purchase-orders", { tenant });
    setOrders(data);
  }, [tenant]);

  const loadItems = useCallback(async () => {
    if (!tenant.branchId) return;
    const data = await apiFetch<InventoryItem[]>("/inventory/items", { tenant });
    setItems(data);
  }, [tenant]);

  useEffect(() => {
    loadVendors().catch((e) => appToast.error(e instanceof Error ? e.message : "Failed to load vendors"));
  }, [loadVendors]);

  useEffect(() => {
    if (!tenant.branchId) return;
    Promise.all([loadOrders(), loadItems()]).catch((e) =>
      appToast.error(e instanceof Error ? e.message : "Failed to load procurement data"),
    );
  }, [tenant.branchId, loadOrders, loadItems]);

  const createVendor = async () => {
    try {
      await apiFetch("/procurement/vendors", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          name: vendorForm.name,
          contactName: vendorForm.contactName || undefined,
          email: vendorForm.email || undefined,
        }),
      });
      appToast.success("Vendor created");
      setVendorDrawer(false);
      setVendorForm({ name: "", contactName: "", email: "" });
      loadVendors();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to create vendor");
    }
  };

  const createPo = async () => {
    if (!tenant.branchId) return;
    try {
      const po = await apiFetch<PurchaseOrder>("/procurement/purchase-orders", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          vendorId: poForm.vendorId,
          lines: [
            {
              inventoryItemId: poForm.inventoryItemId,
              quantity: Number(poForm.quantity),
              unitPrice: Number(poForm.unitPrice),
            },
          ],
        }),
      });
      await apiFetch(`/procurement/purchase-orders/${po.id}/submit`, {
        method: "POST",
        tenant,
      });
      appToast.success("Purchase order created and submitted");
      setPoDrawer(false);
      setPoForm({ vendorId: "", inventoryItemId: "", quantity: "", unitPrice: "" });
      loadOrders();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to create PO");
    }
  };

  const receiveGoods = async () => {
    if (!receivePo) return;
    try {
      await apiFetch(`/procurement/purchase-orders/${receivePo.id}/receive`, {
        method: "POST",
        tenant,
        body: JSON.stringify({
          purchaseOrderLineId: receiveLineId,
          quantity: Number(receiveQty),
        }),
      });
      appToast.success("Goods received");
      setReceivePo(null);
      setReceiveLineId("");
      setReceiveQty("");
      loadOrders();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Receive failed");
    }
  };

  return (
    <DashboardShell>
      <ModulePageHeader />
      {!tenant.branchId && <BranchRequiredNotice />}

      <Tabs.Root value={tab} onValueChange={(d) => setTab(d.value)} variant="enclosed">
        <Tabs.List mb={4}>
          <Tabs.Trigger value="vendors">Vendors</Tabs.Trigger>
          <Tabs.Trigger value="orders">Purchase orders</Tabs.Trigger>
          <Tabs.Trigger value="payments">Vendor payments</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="vendors">
          <Flex mb={3}>
            <Button size="sm" colorPalette="blue" onClick={() => setVendorDrawer(true)}>
              + Add vendor
            </Button>
          </Flex>
          <ContentCard>
            <TableScrollArea>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Name</Table.ColumnHeader>
                    <Table.ColumnHeader>Contact</Table.ColumnHeader>
                    <Table.ColumnHeader>Email</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {vendors.map((v) => (
                    <Table.Row key={v.id}>
                      <Table.Cell>{v.name}</Table.Cell>
                      <Table.Cell>{v.contactName ?? "—"}</Table.Cell>
                      <Table.Cell>{v.email ?? "—"}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </TableScrollArea>
            {vendors.length === 0 && (
              <EmptyState title="No vendors" description="Add a supplier to create purchase orders." />
            )}
          </ContentCard>
        </Tabs.Content>

        <Tabs.Content value="orders">
          <Flex mb={3}>
            <Button
              size="sm"
              colorPalette="blue"
              onClick={() => setPoDrawer(true)}
              disabled={!tenant.branchId || vendors.length === 0}
            >
              + New PO
            </Button>
          </Flex>
          <ContentCard>
            <TableScrollArea>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Vendor</Table.ColumnHeader>
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                    <Table.ColumnHeader>Lines</Table.ColumnHeader>
                    <Table.ColumnHeader />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {orders.map((po) => (
                    <Table.Row key={po.id}>
                      <Table.Cell>{po.vendor.name}</Table.Cell>
                      <Table.Cell>{po.status}</Table.Cell>
                      <Table.Cell>
                        {po.lines.map((l) => (
                          <Text key={l.id} fontSize="xs">
                            {l.inventoryItem.name}: {l.receivedQty}/{l.quantity} @ {l.unitPrice}
                          </Text>
                        ))}
                      </Table.Cell>
                      <Table.Cell>
                        {["SUBMITTED", "PARTIALLY_RECEIVED"].includes(po.status) && (
                          <Button size="xs" variant="outline" onClick={() => setReceivePo(po)}>
                            Receive
                          </Button>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </TableScrollArea>
            {orders.length === 0 && (
              <EmptyState title="No purchase orders" description="Create a PO to receive stock into inventory." />
            )}
          </ContentCard>
        </Tabs.Content>

        <Tabs.Content value="payments">
          <VendorPaymentsTab tenant={tenant} vendors={vendors} orders={orders} />
        </Tabs.Content>
      </Tabs.Root>

      <FormDrawer
        open={vendorDrawer}
        onClose={() => setVendorDrawer(false)}
        title="Add vendor"
        primaryLabel="Save"
        onPrimary={createVendor}
        primaryDisabled={!vendorForm.name.trim()}
      >
        <Stack gap={4}>
          <FormField label="Name" required>
            <Input
              size="sm"
              value={vendorForm.name}
              onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
            />
          </FormField>
          <FormField label="Contact">
            <Input
              size="sm"
              value={vendorForm.contactName}
              onChange={(e) => setVendorForm({ ...vendorForm, contactName: e.target.value })}
            />
          </FormField>
          <FormField label="Email">
            <Input
              size="sm"
              value={vendorForm.email}
              onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
            />
          </FormField>
        </Stack>
      </FormDrawer>

      <FormDrawer
        open={poDrawer}
        onClose={() => setPoDrawer(false)}
        title="New purchase order"
        primaryLabel="Create & submit"
        onPrimary={createPo}
        primaryDisabled={
          !poForm.vendorId || !poForm.inventoryItemId || !poForm.quantity || !poForm.unitPrice
        }
      >
        <Stack gap={4}>
          <FormField label="Vendor" required>
            <AppSelect
              width="100%"
              items={vendors.map((v) => ({ value: v.id, label: v.name }))}
              value={poForm.vendorId}
              onValueChange={(v) => setPoForm({ ...poForm, vendorId: v })}
              placeholder="Select vendor"
            />
          </FormField>
          <FormField label="Item" required>
            <AppSelect
              width="100%"
              items={items.map((i) => ({ value: i.id, label: `${i.name} (${i.sku})` }))}
              value={poForm.inventoryItemId}
              onValueChange={(v) => setPoForm({ ...poForm, inventoryItemId: v })}
              placeholder="Select item"
            />
          </FormField>
          <FormField label="Quantity" required>
            <AppNumberInput
              min={0}
              value={poForm.quantity}
              onValueChange={(v) => setPoForm({ ...poForm, quantity: v })}
            />
          </FormField>
          <FormField label="Unit price" required>
            <AppNumberInput
              min={0}
              value={poForm.unitPrice}
              onValueChange={(v) => setPoForm({ ...poForm, unitPrice: v })}
            />
          </FormField>
        </Stack>
      </FormDrawer>

      <FormDrawer
        open={!!receivePo}
        onClose={() => setReceivePo(null)}
        title="Receive goods"
        primaryLabel="Receive"
        onPrimary={receiveGoods}
        primaryDisabled={!receiveLineId || !receiveQty}
      >
        <Stack gap={4}>
          <FormField label="Line" required>
            <AppSelect
              width="100%"
              items={
                receivePo?.lines.map((l) => ({
                  value: l.id,
                  label: `${l.inventoryItem.name} (remaining ${Number(l.quantity) - Number(l.receivedQty)})`,
                })) ?? []
              }
              value={receiveLineId}
              onValueChange={setReceiveLineId}
              placeholder="Select line"
            />
          </FormField>
          <FormField label="Quantity" required>
            <AppNumberInput
              min={0}
              value={receiveQty}
              onValueChange={setReceiveQty}
            />
          </FormField>
        </Stack>
      </FormDrawer>
    </DashboardShell>
  );
}
