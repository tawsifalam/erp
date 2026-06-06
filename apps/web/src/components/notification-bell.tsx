"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Flex,
  IconButton,
  Menu,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { BellIcon } from "@/components/sidebar-icons";
import { apiFetch, type TenantHeaders } from "@/lib/api-client";
import { useTenant } from "@/lib/tenant-context";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

function tenantHeaders(orgId: string | null, branchId: string | null): TenantHeaders | undefined {
  if (!orgId || !branchId) return undefined;
  return { organizationId: orgId, branchId };
}

export function NotificationBell() {
  const router = useRouter();
  const tenant = useTenant();
  const { organizationId, branchId } = tenant;
  const headers = useMemo(
    () => tenantHeaders(organizationId, branchId),
    [organizationId, branchId],
  );
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const unreadRequestId = useRef(0);

  const refreshUnread = useCallback(async () => {
    if (!headers) return;
    const requestId = ++unreadRequestId.current;
    try {
      const { count } = await apiFetch<{ count: number }>("/notifications/unread-count", {
        tenant: headers,
      });
      if (requestId !== unreadRequestId.current) return;
      setUnread(count);
    } catch {
      if (requestId !== unreadRequestId.current) return;
      setUnread(0);
    }
  }, [headers]);

  const loadList = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    try {
      const data = await apiFetch<NotificationRow[]>("/notifications?limit=20", {
        tenant: headers,
      });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!headers) {
      unreadRequestId.current += 1;
      setUnread(0);
      return;
    }
    refreshUnread();
  }, [headers, refreshUnread]);

  const markRead = async (id: string, link: string | null) => {
    if (!headers) return;
    await apiFetch(`/notifications/${id}/read`, { method: "PATCH", tenant: headers });
    await refreshUnread();
    await loadList();
    if (link) router.push(link);
  };

  const markAllRead = async () => {
    if (!headers) return;
    await apiFetch("/notifications/read-all", { method: "PATCH", tenant: headers });
    await refreshUnread();
    await loadList();
  };

  return (
    <Menu.Root
      positioning={{ placement: "bottom-end" }}
      onOpenChange={(details) => {
        if (details.open) loadList();
      }}
    >
      <Menu.Trigger asChild>
        <IconButton
          aria-label="Notifications"
          title="Notifications"
          variant="outline"
          size="sm"
          data-testid="notification-bell"
        >
          <Box position="relative" display="inline-flex">
            <BellIcon boxSize={4} />
            {unread > 0 && (
              <Box
                position="absolute"
                top="-4px"
                right="-4px"
                minW="16px"
                h="16px"
                px="4px"
                borderRadius="full"
                bg="red.500"
                color="white"
                fontSize="10px"
                fontWeight="bold"
                display="flex"
                alignItems="center"
                justifyContent="center"
                data-testid="notification-unread-badge"
              >
                {unread > 9 ? "9+" : unread}
              </Box>
            )}
          </Box>
        </IconButton>
      </Menu.Trigger>
      <Menu.Positioner zIndex={1500}>
        <Menu.Content minW="20rem" maxW="22rem" p={0}>
          <Flex px={3} py={2} align="center" justify="space-between" borderBottomWidth="1px">
            <Text fontWeight="semibold" fontSize="sm">
              Notifications
            </Text>
            {unread > 0 && (
              <Button size="xs" variant="ghost" onClick={markAllRead}>
                Mark all read
              </Button>
            )}
          </Flex>
          <Box maxH="320px" overflowY="auto" data-testid="notification-list">
            {loading ? (
              <Flex justify="center" py={6}>
                <Spinner size="sm" />
              </Flex>
            ) : items.length === 0 ? (
              <Text px={3} py={4} fontSize="sm" color="fg.muted">
                No notifications
              </Text>
            ) : (
              items.map((n) => (
                <Menu.Item
                  key={n.id}
                  value={n.id}
                  onClick={() => markRead(n.id, n.link)}
                  data-testid={`notification-item-${n.id}`}
                  bg={n.readAt ? undefined : "blue.50"}
                >
                  <Box>
                    <Text fontSize="sm" fontWeight={n.readAt ? "normal" : "semibold"}>
                      {n.title}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" lineClamp={2}>
                      {n.body}
                    </Text>
                  </Box>
                </Menu.Item>
              ))
            )}
          </Box>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}
