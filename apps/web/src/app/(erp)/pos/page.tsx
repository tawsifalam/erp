"use client";

import { Link, Tabs } from "@chakra-ui/react";
import NextLink from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePageHeader } from "@/components/module-page-header";
import { useModuleTab } from "@/lib/use-module-tab";
import { useTenantHeaders } from "@/lib/tenant-context";
import { OrdersTab } from "./orders-tab";
import { MenuTab } from "./menu-tab";

export default function PosPage() {
  const tenant = useTenantHeaders();
  const [tab, setTab] = useModuleTab("orders");

  return (
    <DashboardShell>
      <ModulePageHeader
        actions={
          <Link asChild colorPalette="blue">
            <NextLink href="/pos/kitchen">Kitchen display →</NextLink>
          </Link>
        }
      />
      <Tabs.Root value={tab} onValueChange={(d) => setTab(d.value)} variant="enclosed">
        <Tabs.List mb={4}>
          <Tabs.Trigger value="orders">Orders</Tabs.Trigger>
          <Tabs.Trigger value="menu">Menu</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="orders">
          <OrdersTab tenant={tenant} />
        </Tabs.Content>
        <Tabs.Content value="menu">
          <MenuTab tenant={tenant} />
        </Tabs.Content>
      </Tabs.Root>
    </DashboardShell>
  );
}
