"use client";

import { Input, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import { FormSection } from "@/components/form-section";
import { FormField } from "@erp/ui";
import type { Guest, Room } from "@/lib/pms-types";
import type { InclusionPackageOption } from "@/lib/pms-types";
import type { TenantHeaders } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export type ReservationFormState = {
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  totalAmount: string;
  status: "CONFIRMED" | "INQUIRY";
  paidAmount: string;
  adultCount: string;
  childCount: string;
  packageId: string;
  mealsPerGuestPerNightOverride: string;
};

type ReservationFormFieldsProps = {
  tenant: TenantHeaders;
  branchId: string;
  mode: "create" | "edit";
  form: ReservationFormState;
  onChange: (form: ReservationFormState) => void;
  guests: Guest[];
  packages: InclusionPackageOption[];
  availableRooms: Room[];
  excludeReservationId?: string;
  showStatus?: boolean;
  pricingHint?: string | null;
  onPricingHint?: (hint: string | null) => void;
};

export function ReservationFormFields({
  tenant,
  branchId,
  mode,
  form,
  onChange,
  guests,
  packages,
  availableRooms,
  excludeReservationId,
  showStatus = mode === "create",
  pricingHint,
  onPricingHint,
}: ReservationFormFieldsProps) {
  const set = (patch: Partial<ReservationFormState>) =>
    onChange({ ...form, ...patch });

  useEffect(() => {
    if (!form.roomId || !form.checkIn || !form.checkOut || form.checkOut <= form.checkIn) {
      onPricingHint?.(null);
      return;
    }
    const params = new URLSearchParams({
      roomId: form.roomId,
      checkIn: `${form.checkIn}T14:00:00Z`,
      checkOut: `${form.checkOut}T11:00:00Z`,
      adultCount: form.adultCount || "1",
      childCount: form.childCount || "0",
    });
    let cancelled = false;
    apiFetch<{
      totalAmount: number;
      roomAmount: number;
      fbAmount: number;
      ratePlanName: string | null;
      inclusionPackageId: string | null;
      inclusionPackageName: string | null;
    }>(`/pms/pricing/quote?${params}`, { tenant })
      .then((quote) => {
        if (cancelled) return;
        const patch: Partial<ReservationFormState> = {
          totalAmount: String(quote.totalAmount),
        };
        if (quote.inclusionPackageId) {
          patch.packageId = quote.inclusionPackageId;
        }
        onChange({ ...form, ...patch });
        const parts: string[] = [];
        if (quote.ratePlanName) {
          parts.push(`Rate plan: ${quote.ratePlanName}`);
        } else {
          parts.push("Room base rate");
        }
        if (quote.fbAmount > 0 && quote.inclusionPackageName) {
          parts.push(
            `F&B (${quote.inclusionPackageName}): ৳${quote.fbAmount.toLocaleString()} for stay`,
          );
        } else if (quote.inclusionPackageName) {
          parts.push(`Includes package: ${quote.inclusionPackageName}`);
        }
        onPricingHint?.(parts.join(" · "));
      })
      .catch(() => {
        if (!cancelled) onPricingHint?.(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quote when stay inputs change
  }, [
    form.roomId,
    form.checkIn,
    form.checkOut,
    form.adultCount,
    form.childCount,
    tenant.organizationId,
  ]);

  const roomOptions =
    form.status === "INQUIRY" && mode === "create"
      ? []
      : availableRooms;

  return (
    <Stack gap={6} width="100%">
      {showStatus && (
        <FormSection title="Status & guest" description="Who is staying and booking type.">
          <Stack gap={4} width="100%">
            <FormField label="Status">
              <AppSelect
                width="100%"
                items={[
                  { value: "CONFIRMED", label: "Confirmed" },
                  { value: "INQUIRY", label: "Inquiry (hold)" },
                ]}
                value={form.status}
                onValueChange={(v) =>
                  set({ status: v as "CONFIRMED" | "INQUIRY", roomId: "" })
                }
              />
            </FormField>
            <FormField label="Guest" required>
              <AppSelect
                width="100%"
                items={[
                  { value: "", label: "Select guest" },
                  ...guests.map((g) => ({ value: g.id, label: g.fullName })),
                ]}
                value={form.guestId}
                onValueChange={(v) => set({ guestId: v })}
                placeholder="Guest"
              />
            </FormField>
          </Stack>
        </FormSection>
      )}

      {!showStatus && (
        <FormSection title="Guest" description="Update guest for this stay.">
          <FormField label="Guest" required>
            <AppSelect
              width="100%"
              items={[
                { value: "", label: "Select guest" },
                ...guests.map((g) => ({ value: g.id, label: g.fullName })),
              ]}
              value={form.guestId}
              onValueChange={(v) => set({ guestId: v })}
              placeholder="Guest"
            />
          </FormField>
        </FormSection>
      )}

      <FormSection title="Dates & room" description="Stay dates and assigned room.">
        <Stack gap={4} width="100%">
          <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4} width="100%">
            <FormField label="Check-in" required>
              <Input
                size="sm"
                width="100%"
                type="date"
                value={form.checkIn}
                onChange={(e) => set({ checkIn: e.target.value })}
              />
            </FormField>
            <FormField label="Check-out" required>
              <Input
                size="sm"
                width="100%"
                type="date"
                value={form.checkOut}
                onChange={(e) => set({ checkOut: e.target.value })}
              />
            </FormField>
          </SimpleGrid>
          {form.status === "CONFIRMED" || mode === "edit" ? (
            <FormField label="Room" required>
              <AppSelect
                width="100%"
                items={[
                  { value: "", label: "Available room" },
                  ...roomOptions.map((r) => ({
                    value: r.id,
                    label: `${r.roomNumber} — ${r.roomType.name}`,
                  })),
                ]}
                value={form.roomId}
                onValueChange={(v) => set({ roomId: v })}
                placeholder="Available room"
              />
            </FormField>
          ) : (
            <InquiryRoomPicker
              tenant={tenant}
              branchId={branchId}
              value={form.roomId}
              onChange={(roomId) => set({ roomId })}
            />
          )}
        </Stack>
      </FormSection>

      {mode === "create" && (
        <FormSection
          title="Party & package"
          description="Headcount and complimentary inclusion package."
        >
          <Stack gap={4} width="100%">
            <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4} width="100%">
              <FormField label="Adults">
                <Input
                  size="sm"
                  width="100%"
                  type="number"
                  min={1}
                  value={form.adultCount}
                  onChange={(e) => set({ adultCount: e.target.value })}
                />
              </FormField>
              <FormField label="Children">
                <Input
                  size="sm"
                  width="100%"
                  type="number"
                  min={0}
                  value={form.childCount}
                  onChange={(e) => set({ childCount: e.target.value })}
                />
              </FormField>
            </SimpleGrid>
            <FormField label="Package">
              <AppSelect
                width="100%"
                items={[
                  { value: "", label: "Default package" },
                  ...packages.map((p) => ({
                    value: p.id,
                    label: p.isDefault ? `${p.name} (default)` : p.name,
                  })),
                ]}
                value={form.packageId}
                onValueChange={(v) => set({ packageId: v })}
              />
            </FormField>
            <FormField label="Meals per guest per night (override)" help="Optional.">
              <Input
                size="sm"
                width="100%"
                type="number"
                placeholder="Use package default"
                value={form.mealsPerGuestPerNightOverride}
                onChange={(e) => set({ mealsPerGuestPerNightOverride: e.target.value })}
              />
            </FormField>
          </Stack>
        </FormSection>
      )}

      <FormSection title="Rates" description="Total and amount paid so far.">
        {pricingHint && (
          <Text fontSize="xs" color="fg.muted" mb={2}>
            {pricingHint}
          </Text>
        )}
        <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4} width="100%">
          <FormField label="Total">
            <Input
              size="sm"
              width="100%"
              type="number"
              aria-label="Total amount"
              data-testid="reservation-total-amount"
              value={form.totalAmount}
              onChange={(e) => set({ totalAmount: e.target.value })}
            />
          </FormField>
          {mode === "create" && (
            <FormField label="Paid">
              <Input
                size="sm"
                width="100%"
                type="number"
                value={form.paidAmount}
                onChange={(e) => set({ paidAmount: e.target.value })}
              />
            </FormField>
          )}
        </SimpleGrid>
      </FormSection>
    </Stack>
  );
}

function InquiryRoomPicker({
  tenant,
  branchId,
  value,
  onChange,
}: {
  tenant: TenantHeaders;
  branchId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    apiFetch<Room[]>(`/pms/rooms?branchId=${branchId}`, { tenant })
      .then(setRooms)
      .catch(() => setRooms([]));
  }, [branchId, tenant.organizationId]);

  return (
    <FormField label="Room (inquiry)" required>
      <AppSelect
        width="100%"
        items={[
          { value: "", label: "Select room for inquiry" },
          ...rooms.map((r) => ({
            value: r.id,
            label: `${r.roomNumber} — ${r.roomType.name} (${r.status})`,
          })),
        ]}
        value={value}
        onValueChange={onChange}
        placeholder="Select room for inquiry"
      />
    </FormField>
  );
}
