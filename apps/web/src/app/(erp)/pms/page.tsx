"use client";

import { useState } from "react";
import { Tabs } from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePageHeader } from "@/components/module-page-header";
import { useTenantHeaders } from "@/lib/tenant-context";
import { ReservationsTab } from "./reservations-tab";
import { RoomsTab } from "./rooms-tab";
import { RoomTypesTab } from "./room-types-tab";
import { GuestsTab } from "./guests-tab";

export default function PmsPage() {
  const tenant = useTenantHeaders();
  const [tab, setTab] = useState("reservations");

  return (
    <DashboardShell>
      <ModulePageHeader />
      <Tabs.Root value={tab} onValueChange={(d) => setTab(d.value)} variant="enclosed">
        <Tabs.List mb={4}>
          <Tabs.Trigger value="reservations">Reservations</Tabs.Trigger>
          <Tabs.Trigger value="rooms">Rooms</Tabs.Trigger>
          <Tabs.Trigger value="room-types">Room types</Tabs.Trigger>
          <Tabs.Trigger value="guests">Guests</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="reservations">
          <ReservationsTab tenant={tenant} />
        </Tabs.Content>
        <Tabs.Content value="rooms">
          <RoomsTab tenant={tenant} />
        </Tabs.Content>
        <Tabs.Content value="room-types">
          <RoomTypesTab tenant={tenant} />
        </Tabs.Content>
        <Tabs.Content value="guests">
          <GuestsTab tenant={tenant} />
        </Tabs.Content>
      </Tabs.Root>
    </DashboardShell>
  );
}
