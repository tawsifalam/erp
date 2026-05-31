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
import { appToast } from "@/lib/app-toast";
import { ContentCard, FormField, LoadingState } from "@erp/ui";
import { useModuleTab } from "@/lib/use-module-tab";

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
  const [tab, setTab] = useModuleTab("create");
  const [checking, setChecking] = useState(true);
  const [createForm, setCreateForm] = useState({ name: "", timezone: "Asia/Dhaka" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OrgSearchResult[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<OrgSearchResult | null>(null);
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
    try {
      const results = await apiFetch<OrgSearchResult[]>(
        `/tenants/organizations/search?q=${encodeURIComponent(searchQuery)}`,
      );
      setSearchResults(results);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Search failed");
    }
  };

  const lookupJoinCode = async () => {
    setSelectedOrg(null);
    try {
      const org = await apiFetch<OrgSearchResult | null>(
        `/tenants/organizations/by-join-code/${encodeURIComponent(joinCode.trim())}`,
      );
      if (!org) {
        appToast.error("No organization found for this join code");
        return;
      }
      setSelectedOrg(org);
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Invalid join code");
    }
  };

  const createOrg = async () => {
    setSubmitting(true);
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
      appToast.error(e instanceof Error ? e.message : "Failed to create organization");
    } finally {
      setSubmitting(false);
    }
  };

  const requestJoin = async (org: OrgSearchResult) => {
    setSubmitting(true);
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
      appToast.error(e instanceof Error ? e.message : "Failed to submit join request");
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
      <ContentCard maxW="480px" w="full" p={8}>
        <LoadingState label="Checking your account…" />
      </ContentCard>
    );
  }

  return (
    <ContentCard maxW="560px" w="full" p={8}>
      <Text fontSize="2xl" fontWeight="bold" mb={1}>
        Welcome to One Venue
      </Text>
      <Text fontSize="sm" color="fg.muted" mb={6}>
        Set up your hospitality workspace in a few steps. Create a new organization if you are
        opening a property, or request access to one that already exists — an admin must approve
        join requests before you can use the app.
      </Text>

      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)}>
        <Tabs.List mb={4}>
          <Tabs.Trigger value="create">Create organization</Tabs.Trigger>
          <Tabs.Trigger value="join">Join organization</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="create">
          <Stack gap={4}>
            <FormField label="Organization name" help="Your property or business name." required>
              <Input
                placeholder="Boulevard Café"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </FormField>
            <FormField label="Timezone" help="Used for the default branch and reporting.">
              <AppSelect
                items={TIMEZONES}
                value={createForm.timezone}
                onValueChange={(tz) => setCreateForm({ ...createForm, timezone: tz })}
                aria-label="Timezone"
              />
            </FormField>
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
              <FormField label="Join code" help="Ask an admin for the organization join code (ov_…).">
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
              </FormField>
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

            <FormField label="Message to admin" help="Optional note included with your join request.">
              <Textarea
                placeholder="I'm joining as front desk staff…"
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
                rows={2}
              />
            </FormField>
          </Stack>
        </Tabs.Content>
      </Tabs.Root>
    </ContentCard>
  );
}
