"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Input, Table, Text } from "@chakra-ui/react";
import { BranchRequiredNotice } from "@/components/branch-required-notice";
import { AppNumberInput } from "@/components/app-number-input";
import { FormDialog } from "@/components/form-dialog";
import { FormDrawer } from "@/components/form-drawer";
import { RowActionsMenu } from "@/components/row-actions-menu";
import {
  EmptyState,
  FormField,
  StatusBadge,
  TableSkeleton,
  ContentCard,
  TableScrollArea,
} from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { Guest, Reservation, Room } from "@/lib/pms-types";
import type { InclusionPackageOption } from "@/lib/pms-types";
import { appToast } from "@/lib/app-toast";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";
import {
  ReservationFormFields,
  type ReservationFormState,
} from "./reservation-form-fields";
import { ReservationInclusionsContent } from "./reservation-inclusions-content";

const EMPTY_FORM: ReservationFormState = {
  guestId: "",
  roomId: "",
  checkIn: "",
  checkOut: "",
  totalAmount: "",
  status: "CONFIRMED",
  paidAmount: "",
  adultCount: "1",
  childCount: "0",
  packageId: "",
  mealsPerGuestPerNightOverride: "",
};

export function ReservationsTab({ tenant }: { tenant: TenantHeaders }) {
  const { ask, dialog } = useConfirmDialog();
  const branchId = tenant.branchId;
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [editRooms, setEditRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<InclusionPackageOption[]>([]);

  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<ReservationFormState>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);

  const [inclusionsReservationId, setInclusionsReservationId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [pricingHint, setPricingHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenant.organizationId || !branchId) return;
    setLoading(true);
    try {
      const [resData, guestData, pkgData] = await Promise.all([
        apiFetch<Reservation[]>(`/pms/reservations?branchId=${branchId}`, { tenant }),
        apiFetch<Guest[]>("/pms/guests", { tenant }),
        apiFetch<InclusionPackageOption[]>("/inclusions/packages", { tenant }),
      ]);
      setReservations(resData);
      setGuests(guestData);
      setPackages(pkgData.map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault })));
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load reservations");
    } finally {
      setLoading(false);
    }
  }, [tenant.organizationId, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const fetchAvailability = useCallback(
    async (checkIn: string, checkOut: string, excludeId?: string) => {
      if (!branchId || !checkIn || !checkOut) return [] as Room[];
      try {
        const q = excludeId ? `&excludeReservationId=${excludeId}` : "";
        return await apiFetch<Room[]>(
          `/pms/availability?branchId=${branchId}&checkIn=${checkIn}T14:00:00Z&checkOut=${checkOut}T11:00:00Z${q}`,
          { tenant },
        );
      } catch {
        return [];
      }
    },
    [branchId, tenant],
  );

  useEffect(() => {
    if (drawerMode !== "create") return;
    if (form.status === "CONFIRMED" && form.checkIn && form.checkOut) {
      fetchAvailability(form.checkIn, form.checkOut).then((rooms) => {
        setAvailableRooms(rooms);
        if (form.roomId && !rooms.some((r) => r.id === form.roomId)) {
          setForm((f) => ({ ...f, roomId: "" }));
        }
      });
    } else if (form.status === "INQUIRY") {
      setAvailableRooms([]);
    }
  }, [drawerMode, form.checkIn, form.checkOut, form.status, form.roomId, fetchAvailability]);

  useEffect(() => {
    if (drawerMode !== "edit" || !editId) return;
    if (form.checkIn && form.checkOut) {
      fetchAvailability(form.checkIn, form.checkOut, editId).then(setEditRooms);
    }
  }, [drawerMode, editId, form.checkIn, form.checkOut, fetchAvailability]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDrawerMode("create");
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setEditId(null);
    setForm(EMPTY_FORM);
    setPricingHint(null);
  };

  const startEdit = (r: Reservation) => {
    if (r.status !== "INQUIRY" && r.status !== "CONFIRMED") return;
    const guestId =
      r.guest.id ?? guests.find((g) => g.fullName === r.guest.fullName)?.id ?? "";
    const roomId = r.room.id ?? "";
    setEditId(r.id);
    setForm({
      ...EMPTY_FORM,
      guestId,
      roomId,
      checkIn: r.checkIn.slice(0, 10),
      checkOut: r.checkOut.slice(0, 10),
      totalAmount: String(r.totalAmount),
      status: r.status as "CONFIRMED" | "INQUIRY",
    });
    setDrawerMode("edit");
  };

  const saveEdit = async () => {
    if (!branchId || !editId) return;
    if (!form.guestId || !form.roomId || !form.checkIn || !form.checkOut) {
      appToast.error("Guest, room, and dates are required.");
      return;
    }
    try {
      await apiFetch(`/pms/reservations/${editId}?branchId=${branchId}`, {
        method: "PATCH",
        tenant,
        body: JSON.stringify({
          guestId: form.guestId,
          roomId: form.roomId,
          checkIn: `${form.checkIn}T14:00:00Z`,
          checkOut: `${form.checkOut}T11:00:00Z`,
          totalAmount: Number(form.totalAmount),
        }),
      });
      closeDrawer();
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to update reservation");
    }
  };

  const handleCreate = async () => {
    if (!branchId) return;
    if (!form.guestId || !form.roomId || !form.checkIn || !form.checkOut) {
      appToast.error("Guest, room, check-in, and check-out are required.");
      return;
    }
    if (form.checkOut <= form.checkIn) {
      appToast.error("Check-out must be after check-in.");
      return;
    }
    try {
      await apiFetch("/pms/reservations", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          branchId,
          guestId: form.guestId,
          roomId: form.roomId,
          checkIn: `${form.checkIn}T14:00:00Z`,
          checkOut: `${form.checkOut}T11:00:00Z`,
          totalAmount: Number(form.totalAmount),
          paidAmount: form.paidAmount ? Number(form.paidAmount) : undefined,
          status: form.status,
          adultCount: Number(form.adultCount) || 1,
          childCount: Number(form.childCount) || 0,
          packageId: form.packageId || undefined,
          mealsPerGuestPerNightOverride: form.mealsPerGuestPerNightOverride
            ? Number(form.mealsPerGuestPerNightOverride)
            : undefined,
        }),
      });
      closeDrawer();
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to create reservation");
    }
  };

  const handleAction = async (
    id: string,
    action: "check-in" | "check-out" | "cancel" | "confirm",
  ) => {
    if (!branchId) return;
    const path =
      action === "confirm"
        ? `/pms/reservations/${id}/confirm?branchId=${branchId}`
        : `/pms/reservations/${id}/${action}?branchId=${branchId}`;
    await apiFetch(path, { method: "PATCH", tenant });
    load();
  };

  const savePayment = async () => {
    if (!branchId || !paymentId) return;
    await apiFetch(`/pms/reservations/${paymentId}/payment?branchId=${branchId}`, {
      method: "PATCH",
      tenant,
      body: JSON.stringify({ paidAmount: Number(paymentAmount) }),
    });
    setPaymentId(null);
    setPaymentAmount("");
    load();
  };

  const doRemove = async (id: string) => {
    if (!branchId) return;
    try {
      await apiFetch(`/pms/reservations/${id}?branchId=${branchId}`, {
        method: "DELETE",
        tenant,
      });
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Cannot delete reservation");
    }
  };

  const confirmRemove = (reservation: Reservation) => {
    ask({
      title: "Delete reservation?",
      description: `${reservation.guest.fullName}'s reservation will be removed permanently.`,
      confirmLabel: "Delete",
      onConfirm: () => doRemove(reservation.id),
    });
  };

  const canSubmitCreate =
    Boolean(form.guestId && form.roomId && form.checkIn && form.checkOut) &&
    form.checkOut > form.checkIn;

  if (!branchId) {
    return <BranchRequiredNotice />;
  }

  return (
    <>
      {dialog}
      <Flex gap={2} mb={4} wrap="wrap">
        <Button size="sm" onClick={load}>
          Refresh
        </Button>
        <Button
          size="sm"
          colorPalette="blue"
          w={{ base: "full", sm: "auto" }}
          onClick={openCreate}
        >
          + New reservation
        </Button>
      </Flex>

      <ContentCard p={0} overflow="hidden">
        {loading ? (
          <Box p={4}>
            <TableSkeleton rows={5} columns={8} />
          </Box>
        ) : (
          <>
            <TableScrollArea>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Guest</Table.ColumnHeader>
                    <Table.ColumnHeader>Room</Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: "none", md: "table-cell" }}>
                      Check-in
                    </Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: "none", lg: "table-cell" }}>
                      Check-out
                    </Table.ColumnHeader>
                    <Table.ColumnHeader>Total</Table.ColumnHeader>
                    <Table.ColumnHeader display={{ base: "none", md: "table-cell" }}>
                      Paid
                    </Table.ColumnHeader>
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                    <Table.ColumnHeader>Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {reservations.map((r) => (
                    <Table.Row key={r.id}>
                      <Table.Cell>{r.guest.fullName}</Table.Cell>
                      <Table.Cell>{r.room.roomNumber}</Table.Cell>
                      <Table.Cell display={{ base: "none", md: "table-cell" }}>
                        {new Date(r.checkIn).toLocaleDateString()}
                      </Table.Cell>
                      <Table.Cell display={{ base: "none", lg: "table-cell" }}>
                        {new Date(r.checkOut).toLocaleDateString()}
                      </Table.Cell>
                      <Table.Cell>৳{Number(r.totalAmount).toLocaleString()}</Table.Cell>
                      <Table.Cell display={{ base: "none", md: "table-cell" }}>
                        ৳{Number(r.paidAmount ?? 0).toLocaleString()}
                      </Table.Cell>
                      <Table.Cell>
                        <StatusBadge status={r.status} />
                      </Table.Cell>
                      <Table.Cell>
                        <Flex gap={1} wrap="wrap" align="center">
                          {r.status === "INQUIRY" && (
                            <Button
                              size="xs"
                              colorPalette="blue"
                              onClick={() => handleAction(r.id, "confirm")}
                            >
                              Confirm
                            </Button>
                          )}
                          {r.status === "CONFIRMED" && (
                            <Button
                              size="xs"
                              colorPalette="green"
                              onClick={() => handleAction(r.id, "check-in")}
                            >
                              Check in
                            </Button>
                          )}
                          {r.status === "CHECKED_IN" && (
                            <Button
                              size="xs"
                              colorPalette="orange"
                              onClick={() => handleAction(r.id, "check-out")}
                            >
                              Check out
                            </Button>
                          )}
                          <RowActionsMenu
                            items={[
                              ...(r.status === "CHECKED_IN"
                                ? [
                                    {
                                      label: "Inclusions",
                                      onClick: () => setInclusionsReservationId(r.id),
                                    },
                                  ]
                                : []),
                              {
                                label: "Payment",
                                onClick: () => {
                                  setPaymentId(r.id);
                                  setPaymentAmount(String(r.paidAmount ?? 0));
                                },
                              },
                              ...((r.status === "INQUIRY" || r.status === "CONFIRMED")
                                ? [
                                    {
                                      label: "Edit",
                                      onClick: () => startEdit(r),
                                    },
                                  ]
                                : []),
                              ...((r.status === "CONFIRMED" || r.status === "INQUIRY")
                                ? [
                                    {
                                      label: "Cancel",
                                      onClick: () => handleAction(r.id, "cancel"),
                                    },
                                  ]
                                : []),
                              ...(r.status !== "CHECKED_IN"
                                ? [
                                    {
                                      label: "Delete",
                                      onClick: () => confirmRemove(r),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </TableScrollArea>
            {reservations.length === 0 && (
              <Box p={4}>
                <EmptyState
                  title="No reservations yet"
                  description="Create a reservation to assign guests to rooms for this branch."
                  icon="🛎️"
                />
              </Box>
            )}
          </>
        )}
      </ContentCard>

      <FormDrawer
        open={drawerMode === "create"}
        onClose={closeDrawer}
        title="New reservation"
        description="Book a guest into an available room."
        size="lg"
        primaryLabel="Create"
        onPrimary={handleCreate}
        primaryDisabled={!canSubmitCreate}
      >
        <ReservationFormFields
          tenant={tenant}
          branchId={branchId}
          mode="create"
          form={form}
          onChange={setForm}
          guests={guests}
          packages={packages}
          availableRooms={availableRooms}
          pricingHint={pricingHint}
          onPricingHint={setPricingHint}
        />
        {!canSubmitCreate && (
          <Text fontSize="xs" color="fg.muted" mt={2}>
            Select guest, room, and valid check-in/check-out dates.
          </Text>
        )}
      </FormDrawer>

      <FormDrawer
        open={drawerMode === "edit"}
        onClose={closeDrawer}
        title="Edit reservation"
        size="lg"
        primaryLabel="Save"
        onPrimary={saveEdit}
      >
        <ReservationFormFields
          tenant={tenant}
          branchId={branchId}
          mode="edit"
          form={form}
          onChange={setForm}
          guests={guests}
          packages={packages}
          availableRooms={editRooms}
          showStatus={false}
          pricingHint={pricingHint}
          onPricingHint={setPricingHint}
        />
      </FormDrawer>

      <FormDialog
        open={!!paymentId}
        onClose={() => {
          setPaymentId(null);
          setPaymentAmount("");
        }}
        title="Record payment"
        primaryLabel="Save"
        onPrimary={savePayment}
      >
        <FormField label="Paid amount">
          <AppNumberInput
            min={0}
            value={paymentAmount}
            onValueChange={setPaymentAmount}
          />
        </FormField>
      </FormDialog>

      <FormDrawer
        open={!!inclusionsReservationId && !!branchId}
        onClose={() => setInclusionsReservationId(null)}
        title="Guest inclusions"
        description="Complimentary meals and amenities for this stay."
        size="md"
        cancelLabel="Close"
      >
        {inclusionsReservationId && branchId && (
          <ReservationInclusionsContent
            tenant={tenant}
            branchId={branchId}
            reservationId={inclusionsReservationId}
          />
        )}
      </FormDrawer>
    </>
  );
}
