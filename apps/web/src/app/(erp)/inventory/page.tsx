"use client";

import { Tabs } from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePageHeader } from "@/components/module-page-header";
import { useTenantHeaders } from "@/lib/tenant-context";
import { useModuleTab } from "@/lib/use-module-tab";
import { InventoryItemsTab } from "./items-tab";
import { RecipesTab } from "./recipes-tab";

export default function InventoryPage() {
  const tenant = useTenantHeaders();
  const [tab, setTab] = useModuleTab("items");

  return (
    <DashboardShell>
      <ModulePageHeader />
      <Tabs.Root value={tab} onValueChange={(d) => setTab(d.value)} variant="enclosed">
        <Tabs.List mb={4}>
          <Tabs.Trigger value="items">Items & movements</Tabs.Trigger>
          <Tabs.Trigger value="recipes">Recipes (BOM)</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="items">
          <InventoryItemsTab tenant={tenant} />
        </Tabs.Content>
        <Tabs.Content value="recipes">
          <RecipesTab tenant={tenant} />
        </Tabs.Content>
      </Tabs.Root>
    </DashboardShell>
  );
}
