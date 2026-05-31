"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  Avatar,
  Box,
  Collapsible,
  Flex,
  Stack,
  Text,
  Button,
  IconButton,
} from "@chakra-ui/react";
import { useUser } from "@propelauth/nextjs/client";
import { signOut } from "@/lib/auth";
import { formatRoleLabel } from "@erp/utils";
import {
  BOTTOM_NAV,
  filterNavGroups,
  filterNavLinks,
  isNavActive,
  TOP_NAV,
  type NavGroup,
  type NavLinkItem,
} from "./nav-config";
import { useTenant } from "@/lib/tenant-context";
import { ChevronDownIcon, LogOutIcon } from "./sidebar-icons";

const sidebarLinkStyles = {
  display: "flex",
  alignItems: "center",
  gap: 3,
  px: 3,
  py: 2,
  borderRadius: "md",
  fontSize: "sm",
  fontWeight: "medium",
  color: "blue.100",
  transition: "background 0.15s ease, color 0.15s ease",
  _hover: { bg: "whiteAlpha.200", color: "white" },
};

function activeLinkStyles(active: boolean) {
  return active
    ? {
        bg: "white",
        color: "blue.700",
        _hover: { bg: "white", color: "blue.700" },
      }
    : {};
}

function SidebarLink({
  item,
  collapsed,
  active,
  onNavigate,
}: {
  item: NavLinkItem;
  collapsed: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  if (collapsed) {
    return (
      <Box
        asChild
        {...sidebarLinkStyles}
        {...activeLinkStyles(active)}
        justifyContent="center"
        px={2}
        title={item.label}
      >
        <NextLink
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
        >
          <Icon aria-hidden />
        </NextLink>
      </Box>
    );
  }

  return (
    <Box
      asChild
      {...sidebarLinkStyles}
      {...activeLinkStyles(active)}
      justifyContent="flex-start"
    >
      <NextLink
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
      >
        <Icon aria-hidden />
        <Text truncate>{item.label}</Text>
      </NextLink>
    </Box>
  );
}

function SidebarGroupCollapsed({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <Stack gap={1}>
      {group.items.map((item) => (
        <SidebarLink
          key={item.href}
          item={item}
          collapsed
          active={isNavActive(pathname, item.href)}
          onNavigate={onNavigate}
        />
      ))}
    </Stack>
  );
}

function SidebarGroupExpanded({
  group,
  pathname,
  defaultOpen,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  defaultOpen: boolean;
  onNavigate?: () => void;
}) {
  const groupActive = group.items.some((item) => isNavActive(pathname, item.href));
  const [open, setOpen] = useState(defaultOpen || groupActive);

  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive]);

  const GroupIcon = group.icon;

  return (
    <Collapsible.Root open={open} onOpenChange={(details) => setOpen(details.open)}>
      <Collapsible.Trigger asChild>
        <Flex
          align="center"
          gap={3}
          px={3}
          py={2}
          borderRadius="md"
          cursor="pointer"
          color={groupActive ? "white" : "blue.100"}
          fontSize="sm"
          fontWeight="semibold"
          _hover={{ bg: "whiteAlpha.200" }}
        >
          <GroupIcon aria-hidden />
          <Text flex="1" textAlign="left">
            {group.label}
          </Text>
          <ChevronDownIcon
            boxSize={4}
            transition="transform 0.2s ease"
            transform={open ? "rotate(0deg)" : "rotate(-90deg)"}
          />
        </Flex>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Stack gap={0.5} mt={1} pl={4} borderLeftWidth="1px" borderColor="whiteAlpha.300" ml={4}>
          {group.items.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              collapsed={false}
              active={isNavActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </Stack>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function SidebarGroup({
  group,
  collapsed,
  pathname,
  defaultOpen,
  onNavigate,
}: {
  group: NavGroup;
  collapsed: boolean;
  pathname: string;
  defaultOpen: boolean;
  onNavigate?: () => void;
}) {
  if (collapsed) {
    return (
      <SidebarGroupCollapsed group={group} pathname={pathname} onNavigate={onNavigate} />
    );
  }

  return (
    <SidebarGroupExpanded
      group={group}
      pathname={pathname}
      defaultOpen={defaultOpen}
      onNavigate={onNavigate}
    />
  );
}

export function SidebarNavContent({
  collapsed = false,
  onNavigate,
  showBrand = true,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  showBrand?: boolean;
}) {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const { role } = useTenant();

  const topNav = filterNavLinks(role, TOP_NAV);
  const navGroups = filterNavGroups(role);
  const bottomNav = filterNavLinks(role, BOTTOM_NAV);

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : (user?.email?.split("@")[0] ?? "User");

  return (
    <Box flex="1" display="flex" flexDirection="column" minH={0}>
      {showBrand && !collapsed && (
        <Box px={3} py={4} minH="72px">
          <Text fontWeight="bold" fontSize="md" lineHeight="short">
            One Venue
          </Text>
          <Text fontSize="xs" color="blue.100">
            Hospitality ERP
          </Text>
        </Box>
      )}

      <Stack flex="1" gap={1} px={2} py={2} overflowY="auto">
        {topNav.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={isNavActive(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}

        {navGroups.map((group) => (
          <Box key={group.id} mt={2}>
            <SidebarGroup
              group={group}
              collapsed={collapsed}
              pathname={pathname}
              defaultOpen={group.id === "operations"}
              onNavigate={onNavigate}
            />
          </Box>
        ))}
      </Stack>

      <Stack gap={1} px={2} py={3} borderTopWidth="1px" borderColor="whiteAlpha.200">
        {bottomNav.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={isNavActive(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}

        {collapsed ? (
          <IconButton
            aria-label="Sign out"
            title="Sign out"
            variant="ghost"
            color="blue.50"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={() => signOut()}
          >
            <LogOutIcon boxSize={4} />
          </IconButton>
        ) : (
          <Button
            variant="ghost"
            justifyContent="flex-start"
            w="full"
            h="auto"
            gap={3}
            px={3}
            py={2}
            borderRadius="md"
            fontSize="sm"
            fontWeight="medium"
            color="blue.100"
            _hover={{ bg: "whiteAlpha.200", color: "white" }}
            onClick={() => signOut()}
          >
            <LogOutIcon boxSize={4} />
            <Text>Sign out</Text>
          </Button>
        )}
      </Stack>

      <Flex
        align="center"
        gap={3}
        px={3}
        py={4}
        minH="72px"
        borderTopWidth="1px"
        borderColor="whiteAlpha.200"
        bg="blue.800"
        justify={collapsed ? "center" : "flex-start"}
      >
        <Avatar.Root size="sm" colorPalette="blue" flexShrink={0}>
          <Avatar.Fallback name={displayName} />
        </Avatar.Root>
        {!collapsed && (
          <Box minW={0}>
            <Text fontSize="sm" fontWeight="medium" truncate>
              {loading ? "Loading…" : displayName}
            </Text>
            <Text fontSize="xs" color="blue.100" truncate>
              {user?.email ?? ""}
            </Text>
            {role && (
              <Text
                fontSize="xs"
                color="blue.200"
                mt={0.5}
                truncate
                title={`Your role: ${formatRoleLabel(role)}`}
              >
                {formatRoleLabel(role)}
              </Text>
            )}
          </Box>
        )}
      </Flex>
    </Box>
  );
}
