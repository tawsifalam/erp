"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { apiFetch } from "@/lib/api-client";
import type { TenantHeaders } from "@/lib/api-client";
import { InclusionType } from "@erp/types";
import { appToast } from "@/lib/app-toast";

type Allowance = {
  id: string;
  inclusionType: string;
  inclusionRecipeId: string;
  recipeName: string;
  entitledQty: number;
  consumedQty: number;
  remainingQty: number;
  unitLabel: string;
};

export function ReservationInclusionsPanel({
  tenant,
  branchId,
  reservationId,
  onClose,
}: {
  tenant: TenantHeaders;
  branchId: string;
  reservationId: string;
  onClose: () => void;
}) {
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Allowance[]>(
        `/inclusions/reservations/${reservationId}/allowances?branchId=${branchId}`,
        { tenant },
      );
      setAllowances(data);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to load allowances");
    } finally {
      setLoading(false);
    }
  }, [branchId, reservationId, tenant]);

  useEffect(() => {
    load();
  }, [load]);

  const recordMeal = async (a: Allowance) => {
    try {
      await apiFetch(
        `/inclusions/reservations/${reservationId}/consume?branchId=${branchId}`,
        {
          method: "POST",
          tenant,
          body: JSON.stringify({
            inclusionType: a.inclusionType,
            inclusionRecipeId: a.inclusionRecipeId,
            quantity: 1,
          }),
        },
      );
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Cannot record meal");
    }
  };

  const reissueKit = async (a: Allowance) => {
    try {
      await apiFetch(
        `/inclusions/reservations/${reservationId}/consume?branchId=${branchId}`,
        {
          method: "POST",
          tenant,
          body: JSON.stringify({
            inclusionType: a.inclusionType,
            inclusionRecipeId: a.inclusionRecipeId,
            quantity: 1,
          }),
        },
      );
      load();
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Cannot re-issue kit");
    }
  };

  return (
    <Box
      position="fixed"
      inset={0}
      bg="blackAlpha.400"
      display="flex"
      alignItems="center"
      justifyContent="center"
      zIndex={10}
    >
      <Box bg="white" p={6} borderRadius="md" minW="360px" maxW="90vw">
        <Flex justify="space-between" align="center" mb={3}>
          <Text fontWeight="semibold">
            Guest inclusions
          </Text>
          <Button size="xs" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </Flex>
        {loading ? (
          <Text fontSize="sm" color="fg.muted">
            Loading…
          </Text>
        ) : allowances.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            No allowances yet. Check in the guest to snapshot package entitlements.
          </Text>
        ) : (
          <Stack gap={3}>
            {allowances.map((a) => (
              <Box key={a.id} p={3} borderWidth="1px" borderRadius="md">
                <Text fontWeight="medium">{a.recipeName}</Text>
                <Text fontSize="sm" color="fg.muted">
                  {a.consumedQty} / {a.entitledQty} {a.unitLabel} used
                  {a.remainingQty > 0 ? ` (${a.remainingQty} remaining)` : ""}
                </Text>
                {a.inclusionType === InclusionType.MEAL && a.remainingQty > 0 && (
                  <Button size="xs" mt={2} onClick={() => recordMeal(a)}>
                    Record comp meal (1)
                  </Button>
                )}
                {a.inclusionType === InclusionType.AMENITY_KIT && (
                  <Text fontSize="xs" color="fg.muted" mt={1}>
                    {a.consumedQty > 0 ? "Issued at check-in" : "Not yet issued"}
                  </Text>
                )}
                {a.inclusionType === InclusionType.AMENITY_KIT && a.remainingQty > 0 && (
                  <Button size="xs" mt={2} variant="outline" onClick={() => reissueKit(a)}>
                    Re-issue amenity kit
                  </Button>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
