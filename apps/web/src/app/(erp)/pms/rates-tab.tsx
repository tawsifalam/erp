"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Flex,
  Input,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import {
  ContentCard,
  EmptyState,
  FormField,
  TableScrollArea,
  TableSkeleton,
} from "@erp/ui";
import { FormDrawer } from "@/components/form-drawer";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import type { RoomType } from "@/lib/pms-types";
import { appToast } from "@/lib/app-toast";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";

type RateRule = {
  id: string;
  dayOfWeek: number | null;
  minStayNights: number | null;
  pricePerNight: string | null;
};

type InclusionPackageOption = { id: string; name: string };

type RatePlan = {
  id: string;
  name: string;
  roomTypeId: string;
  validFrom: string;
  validTo: string;
  baseModifier: string;
  isActive: boolean;
  inclusionPackageId?: string | null;
  fbSupplementPerGuestPerNight?: string | null;
  roomType: { id: string; name: string };
  inclusionPackage?: { id: string; name: string } | null;
  rules: RateRule[];
};

const DAY_OPTIONS = [
  { value: "", label: "Any day" },
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

function dayLabel(dow: number | null) {
  if (dow == null) return "Any";
  return DAY_OPTIONS.find((o) => o.value === String(dow))?.label ?? String(dow);
}

export function RatesTab({ tenant }: { tenant: TenantHeaders }) {
  const { ask, dialog } = useConfirmDialog();
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [packages, setPackages] = useState<InclusionPackageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [planDrawer, setPlanDrawer] = useState(false);
  const [rulesPlanId, setRulesPlanId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    roomTypeId: "",
    validFrom: "",
    validTo: "",
    baseModifier: "1",
    inclusionPackageId: "",
    fbSupplementPerGuestPerNight: "",
  });
  const [ruleForm, setRuleForm] = useState({
    dayOfWeek: "",
    minStayNights: "",
    pricePerNight: "",
  });

  const load = useCallback(async () => {
    if (!tenant.organizationId) return;
    setLoading(true);
    try {
      const [planData, rtData, pkgData] = await Promise.all([
        apiFetch<RatePlan[]>("/pms/rate-plans", { tenant }),
        apiFetch<RoomType[]>("/pms/room-types", { tenant }),
        apiFetch<InclusionPackageOption[]>("/inclusions/packages", { tenant }),
      ]);
      setPlans(planData);
      setRoomTypes(rtData);
      setPackages(pkgData);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load rate plans");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreatePlan = () => {
    setEditingPlanId(null);
    setPlanForm({
      name: "",
      roomTypeId: roomTypes[0]?.id ?? "",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      baseModifier: "1",
      inclusionPackageId: "",
      fbSupplementPerGuestPerNight: "",
    });
    setPlanDrawer(true);
  };

  const openEditPlan = (plan: RatePlan) => {
    setEditingPlanId(plan.id);
    setPlanForm({
      name: plan.name,
      roomTypeId: plan.roomTypeId,
      validFrom: plan.validFrom.slice(0, 10),
      validTo: plan.validTo.slice(0, 10),
      baseModifier: String(plan.baseModifier),
      inclusionPackageId: plan.inclusionPackageId ?? "",
      fbSupplementPerGuestPerNight:
        plan.fbSupplementPerGuestPerNight != null
          ? String(plan.fbSupplementPerGuestPerNight)
          : "",
    });
    setPlanDrawer(true);
  };

  const savePlan = async () => {
    if (!planForm.name.trim() || !planForm.roomTypeId) return;
    try {
      const body = {
        name: planForm.name,
        roomTypeId: planForm.roomTypeId,
        validFrom: `${planForm.validFrom}T00:00:00Z`,
        validTo: `${planForm.validTo}T23:59:59Z`,
        baseModifier: Number(planForm.baseModifier) || 1,
        inclusionPackageId: planForm.inclusionPackageId || null,
        fbSupplementPerGuestPerNight: planForm.inclusionPackageId
          ? Number(planForm.fbSupplementPerGuestPerNight) || 0
          : null,
      };
      if (editingPlanId) {
        await apiFetch(`/pms/rate-plans/${editingPlanId}`, {
          method: "PATCH",
          tenant,
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/pms/rate-plans", {
          method: "POST",
          tenant,
          body: JSON.stringify(body),
        });
      }
      setPlanDrawer(false);
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to save rate plan");
    }
  };

  const deletePlan = (id: string, name: string) => {
    ask({
      title: "Delete rate plan",
      description: `Remove "${name}" and all its rules?`,
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await apiFetch(`/pms/rate-plans/${id}`, { method: "DELETE", tenant });
          if (rulesPlanId === id) setRulesPlanId(null);
          load();
        } catch (e) {
          appToast.error(e instanceof Error ? e.message : "Failed to delete");
        }
      },
    });
  };

  const addRule = async () => {
    if (!rulesPlanId) return;
    try {
      await apiFetch(`/pms/rate-plans/${rulesPlanId}/rules`, {
        method: "POST",
        tenant,
        body: JSON.stringify({
          dayOfWeek: ruleForm.dayOfWeek === "" ? null : Number(ruleForm.dayOfWeek),
          minStayNights: ruleForm.minStayNights ? Number(ruleForm.minStayNights) : null,
          pricePerNight: ruleForm.pricePerNight ? Number(ruleForm.pricePerNight) : null,
        }),
      });
      setRuleForm({ dayOfWeek: "", minStayNights: "", pricePerNight: "" });
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to add rule");
    }
  };

  const deleteRule = async (planId: string, ruleId: string) => {
    try {
      await apiFetch(`/pms/rate-plans/${planId}/rules/${ruleId}`, {
        method: "DELETE",
        tenant,
      });
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to delete rule");
    }
  };

  const rulesPlan = plans.find((p) => p.id === rulesPlanId);

  return (
    <>
      {dialog}
      <Flex justify="flex-end" mb={3}>
        <Button size="sm" onClick={openCreatePlan}>
          + Add rate plan
        </Button>
      </Flex>
      <ContentCard>
        {loading ? (
          <TableSkeleton rows={4} columns={5} />
        ) : plans.length === 0 ? (
          <EmptyState
            title="No rate plans"
            description="Create seasonal or weekend plans to price reservations automatically."
          />
        ) : (
          <TableScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Name</Table.ColumnHeader>
                  <Table.ColumnHeader>Room type</Table.ColumnHeader>
                  <Table.ColumnHeader>Valid</Table.ColumnHeader>
                  <Table.ColumnHeader>Modifier</Table.ColumnHeader>
                  <Table.ColumnHeader>F&B bundle</Table.ColumnHeader>
                  <Table.ColumnHeader>Rules</Table.ColumnHeader>
                  <Table.ColumnHeader />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {plans.map((p) => (
                  <Table.Row key={p.id}>
                    <Table.Cell>{p.name}</Table.Cell>
                    <Table.Cell>{p.roomType.name}</Table.Cell>
                    <Table.Cell whiteSpace="nowrap">
                      {p.validFrom.slice(0, 10)} – {p.validTo.slice(0, 10)}
                    </Table.Cell>
                    <Table.Cell>×{Number(p.baseModifier)}</Table.Cell>
                    <Table.Cell whiteSpace="nowrap">
                      {p.inclusionPackage ? (
                        <Text fontSize="xs">
                          {p.inclusionPackage.name}
                          {p.fbSupplementPerGuestPerNight
                            ? ` (+৳${Number(p.fbSupplementPerGuestPerNight).toLocaleString()}/guest/night)`
                            : ""}
                        </Text>
                      ) : (
                        "—"
                      )}
                    </Table.Cell>
                    <Table.Cell>{p.rules.length}</Table.Cell>
                    <Table.Cell>
                      <Flex gap={2} justify="flex-end">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => openEditPlan(p)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setRulesPlanId(p.id)}
                        >
                          Rules
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          colorPalette="red"
                          onClick={() => deletePlan(p.id, p.name)}
                        >
                          Delete
                        </Button>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </TableScrollArea>
        )}
      </ContentCard>

      {rulesPlan && (
        <ContentCard mt={4}>
          <Text fontWeight="semibold" mb={2}>
            Rules for {rulesPlan.name}
          </Text>
          {rulesPlan.rules.length === 0 ? (
            <Text fontSize="sm" color="fg.muted" mb={3}>
              No rules — room base price × modifier applies every night.
            </Text>
          ) : (
            <TableScrollArea mb={3}>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Day</Table.ColumnHeader>
                    <Table.ColumnHeader>Min nights</Table.ColumnHeader>
                    <Table.ColumnHeader>Price/night</Table.ColumnHeader>
                    <Table.ColumnHeader />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {rulesPlan.rules.map((r) => (
                    <Table.Row key={r.id}>
                      <Table.Cell>{dayLabel(r.dayOfWeek)}</Table.Cell>
                      <Table.Cell>{r.minStayNights ?? "—"}</Table.Cell>
                      <Table.Cell>
                        {r.pricePerNight != null ? `৳${Number(r.pricePerNight).toLocaleString()}` : "—"}
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => deleteRule(rulesPlan.id, r.id)}
                        >
                          Remove
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </TableScrollArea>
          )}
          <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
            <FormField label="Day of week">
              <AppSelect
                width="100%"
                items={DAY_OPTIONS}
                value={ruleForm.dayOfWeek}
                onValueChange={(v) => setRuleForm({ ...ruleForm, dayOfWeek: v })}
              />
            </FormField>
            <FormField label="Min stay (nights)">
              <Input
                size="sm"
                type="number"
                value={ruleForm.minStayNights}
                onChange={(e) => setRuleForm({ ...ruleForm, minStayNights: e.target.value })}
              />
            </FormField>
            <FormField label="Price per night (override)">
              <Input
                size="sm"
                type="number"
                value={ruleForm.pricePerNight}
                onChange={(e) => setRuleForm({ ...ruleForm, pricePerNight: e.target.value })}
              />
            </FormField>
          </SimpleGrid>
          <Button size="sm" mt={3} onClick={addRule}>
            Add rule
          </Button>
        </ContentCard>
      )}

      <FormDrawer
        open={planDrawer}
        onClose={() => setPlanDrawer(false)}
        title={editingPlanId ? "Edit rate plan" : "New rate plan"}
        onPrimary={savePlan}
        primaryLabel="Save"
      >
        <Stack gap={4}>
          <FormField label="Name" required>
            <Input
              size="sm"
              value={planForm.name}
              onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
            />
          </FormField>
          <FormField label="Room type" required>
            <AppSelect
              width="100%"
              items={roomTypes.map((rt) => ({ value: rt.id, label: rt.name }))}
              value={planForm.roomTypeId}
              onValueChange={(v) => setPlanForm({ ...planForm, roomTypeId: v })}
            />
          </FormField>
          <SimpleGrid columns={2} gap={3}>
            <FormField label="Valid from">
              <Input
                size="sm"
                type="date"
                value={planForm.validFrom}
                onChange={(e) => setPlanForm({ ...planForm, validFrom: e.target.value })}
              />
            </FormField>
            <FormField label="Valid to">
              <Input
                size="sm"
                type="date"
                value={planForm.validTo}
                onChange={(e) => setPlanForm({ ...planForm, validTo: e.target.value })}
              />
            </FormField>
          </SimpleGrid>
          <FormField label="Base modifier" help="Multiplies room base price when no rule override applies.">
            <Input
              size="sm"
              type="number"
              step="0.01"
              value={planForm.baseModifier}
              onChange={(e) => setPlanForm({ ...planForm, baseModifier: e.target.value })}
            />
          </FormField>
          <FormField
            label="Guest package (F&B bundle)"
            help="When set, reservations using this plan auto-apply the inclusion package."
          >
            <AppSelect
              width="100%"
              items={[
                { value: "", label: "Room only (no package)" },
                ...packages.map((p) => ({ value: p.id, label: p.name })),
              ]}
              value={planForm.inclusionPackageId}
              onValueChange={(v) =>
                setPlanForm({
                  ...planForm,
                  inclusionPackageId: v,
                  fbSupplementPerGuestPerNight: v ? planForm.fbSupplementPerGuestPerNight : "",
                })
              }
              placeholder="Optional package"
            />
          </FormField>
          {planForm.inclusionPackageId && (
            <FormField
              label="F&B supplement per guest per night"
              help="Added to room total (e.g. full board meals charge)."
            >
              <Input
                size="sm"
                type="number"
                min={0}
                value={planForm.fbSupplementPerGuestPerNight}
                onChange={(e) =>
                  setPlanForm({ ...planForm, fbSupplementPerGuestPerNight: e.target.value })
                }
              />
            </FormField>
          )}
        </Stack>
      </FormDrawer>
    </>
  );
}
