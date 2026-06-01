"use client";

import { Tabs } from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePageHeader } from "@/components/module-page-header";
import { useModuleTab } from "@/lib/use-module-tab";
import { useTenantHeaders } from "@/lib/tenant-context";
import { ReservationsTab } from "./reservations-tab";
import { RoomsTab } from "./rooms-tab";
import { RoomTypesTab } from "./room-types-tab";
import { GuestsTab } from "./guests-tab";
import { InclusionsTab } from "./inclusions-tab";
import { RatesTab } from "./rates-tab";

export default function PmsPage() {
  const tenant = useTenantHeaders();
  const [tab, setTab] = useModuleTab("reservations");

  return (
    <DashboardShell>
      <ModulePageHeader />
      <Tabs.Root value={tab} onValueChange={(d) => setTab(d.value)} variant="enclosed">
        <Tabs.List mb={4}>
          <Tabs.Trigger value="reservations">Reservations</Tabs.Trigger>
          <Tabs.Trigger value="rooms">Rooms</Tabs.Trigger>
          <Tabs.Trigger value="room-types">Room types</Tabs.Trigger>
          <Tabs.Trigger value="guests">Guests</Tabs.Trigger>
          <Tabs.Trigger value="inclusions">Guest packages</Tabs.Trigger>
          <Tabs.Trigger value="rates">Rates</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="reservations">
          <ReservationsTab tenant={tenant} />
        </Tabs.Content>
        <Tabs.Content value="rooms">
          <RoomsTab tenant={tenant} active={tab === "rooms"} />
        </Tabs.Content>
        <Tabs.Content value="room-types">
          <RoomTypesTab tenant={tenant} />
        </Tabs.Content>
        <Tabs.Content value="guests">
          <GuestsTab tenant={tenant} />
        </Tabs.Content>
        <Tabs.Content value="inclusions">
          <InclusionsTab tenant={tenant} />
        </Tabs.Content>
        <Tabs.Content value="rates">
          <RatesTab tenant={tenant} />
        </Tabs.Content>
      </Tabs.Root>
    </DashboardShell>
  );
}
