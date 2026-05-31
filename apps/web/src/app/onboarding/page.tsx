"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useUser } from "@propelauth/nextjs/client";
import { AppSelect } from "@/components/app-select";
import { apiFetch } from "@/lib/api-client";
import { syncUserAfterLogin } from "@/lib/auth";
import { useTenant } from "@/lib/tenant-context";
import { getDefaultRouteForRole } from "@erp/utils";
import { Role } from "@erp/types";

type OnboardingStatus = {
  hasMembership: boolean;
  canAccessApp: boolean;
  pendingRequest: {
    id: string;
    organizationId: string;
    organizationName: string;
  } | null;
};

type OrgSearchResult = { id: string; name: string };

const TIMEZONES = [
  { value: "Asia/Dhaka", label: "Asia/Dhaka (GMT+6)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (GMT+5:30)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GMT+4)" },
  { value: "Europe/London", label: "Europe/London (GMT+0)" },
  { value: "America/New_York", label: "America/New_York (GMT-5)" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { loading: authLoading, accessToken } = useUser();
  const tenant = useTenant();
  const [checking, setChecking] = useState(true);
  const [createForm, setCreateForm] = useState({ name: "", timezone: "Asia/Dhaka" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OrgSearchResult[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<OrgSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!accessToken) return;
    await syncUserAfterLogin(undefined, accessToken);
    const status = await apiFetch<OnboardingStatus>("/tenants/onboarding/status");
    if (status.canAccessApp) {
      await tenant.refreshMemberships();
      const memberships = await apiFetch<{ role: string }[]>("/tenants/organizations");
      const role = memberships[0]?.role ?? Role.OWNER;
      router.replace(getDefaultRouteForRole(role));
      return;
    }
    if (status.pendingRequest) {
      router.replace("/onboarding/pending");
      return;
    }
    setChecking(false);
  }, [accessToken, router, tenant]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    checkStatus().catch(() => setChecking(false));
  }, [authLoading, accessToken, checkStatus]);

  const searchOrgs = async () => {
    setError(null);
    try {
      const results = await apiFetch<OrgSearchResult[]>(
        `/tenants/organizations/search?q=${encodeURIComponent(searchQuery)}`,
      );
      setSearchResults(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    }
  };

  const lookupJoinCode = async () => {
    setError(null);
    setSelectedOrg(null);
    try {
      const org = await apiFetch<OrgSearchResult | null>(
        `/tenants/organizations/by-join-code/${encodeURIComponent(joinCode.trim())}`,
      );
      if (!org) {
        setError("No organization found for this join code");
        return;
      }
      setSelectedOrg(org);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid join code");
    }
  };

  const createOrg = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiFetch<{
        organization: { id: string; branches: { id: string }[] };
      }>("/tenants/organizations", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      await tenant.refreshMemberships();
      if (result?.organization?.id) {
        tenant.setOrganizationId(result.organization.id);
        if (result.organization.branches[0]) {
          tenant.setBranchId(result.organization.branches[0].id);
        }
      }
      router.replace(getDefaultRouteForRole(Role.OWNER));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create organization");
    } finally {
      setSubmitting(false);
    }
  };

  const requestJoin = async (org: OrgSearchResult) => {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/tenants/join-requests", {
        method: "POST",
        body: JSON.stringify({
          organizationId: org.id,
          message: joinMessage.trim() || undefined,
        }),
      });
      router.replace("/onboarding/pending");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit join request");
    } finally {
      setSubmitting(false);
    }
  };

  const requestJoinByCode = async () => {
    if (!selectedOrg) return;
    await requestJoin(selectedOrg);
  };

  if (authLoading || checking) {
    return (
      <Box bg="white" borderRadius="lg" p={8} shadow="sm" maxW="480px" w="full">
        <Text color="fg.muted">Loading…</Text>
      </Box>
    );
  }

  return (
    <Box bg="white" borderRadius="lg" p={8} shadow="sm" maxW="560px" w="full">
      <Text fontSize="xl" fontWeight="bold" mb={1}>
        Welcome to One Venue
      </Text>
      <Text fontSize="sm" color="fg.muted" mb={6}>
        Create your organization or request to join an existing one. An admin must approve join
        requests before you can access the app.
      </Text>

      {error && (
        <Text color="red.500" fontSize="sm" mb={4}>
          {error}
        </Text>
      )}

      <Tabs.Root defaultValue="create">
        <Tabs.List mb={4}>
          <Tabs.Trigger value="create">Create organization</Tabs.Trigger>
          <Tabs.Trigger value="join">Join organization</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="create">
          <Stack gap={4}>
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={1}>
                Organization name
              </Text>
              <Input
                placeholder="Boulevard Café"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={1}>
                Timezone
              </Text>
              <AppSelect
                items={TIMEZONES}
                value={createForm.timezone}
                onValueChange={(tz) => setCreateForm({ ...createForm, timezone: tz })}
                aria-label="Timezone"
              />
            </Box>
            <Button
              colorPalette="blue"
              onClick={createOrg}
              loading={submitting}
              disabled={!createForm.name.trim()}
            >
              Create organization
            </Button>
          </Stack>
        </Tabs.Content>

        <Tabs.Content value="join">
          <Stack gap={6}>
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                Search by name
              </Text>
              <Flex gap={2} mb={2}>
                <Input
                  placeholder="Search organizations…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchOrgs()}
                />
                <Button variant="outline" onClick={searchOrgs} disabled={searchQuery.length < 2}>
                  Search
                </Button>
              </Flex>
              {searchResults.length > 0 && (
                <Stack gap={2}>
                  {searchResults.map((org) => (
                    <Flex
                      key={org.id}
                      p={3}
                      borderWidth="1px"
                      borderRadius="md"
                      align="center"
                      justify="space-between"
                    >
                      <Text fontSize="sm">{org.name}</Text>
                      <Button
                        size="sm"
                        colorPalette="blue"
                        onClick={() => requestJoin(org)}
                        loading={submitting}
                      >
                        Request to join
                      </Button>
                    </Flex>
                  ))}
                </Stack>
              )}
            </Box>

            <Box borderTopWidth="1px" pt={4}>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                Or use a join code
              </Text>
              <Flex gap={2} mb={2}>
                <Input
                  placeholder="ov_xxxxxxxx"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
                <Button variant="outline" onClick={lookupJoinCode} disabled={!joinCode.trim()}>
                  Look up
                </Button>
              </Flex>
              {selectedOrg && (
                <Flex
                  p={3}
                  borderWidth="1px"
                  borderRadius="md"
                  align="center"
                  justify="space-between"
                  mb={2}
                >
                  <Text fontSize="sm">{selectedOrg.name}</Text>
                  <Button
                    size="sm"
                    colorPalette="blue"
                    onClick={requestJoinByCode}
                    loading={submitting}
                  >
                    Request to join
                  </Button>
                </Flex>
              )}
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={1}>
                Message to admin (optional)
              </Text>
              <Textarea
                placeholder="I'm joining as front desk staff…"
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
                rows={2}
              />
            </Box>
          </Stack>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
}
