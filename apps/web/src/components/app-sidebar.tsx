"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  Avatar,
  Box,
  Collapsible,
  Flex,
  IconButton,
  Stack,
  Text,
  Button,
} from "@chakra-ui/react";
import { useUser } from "@propelauth/nextjs/client";
import { signOut } from "@/lib/auth";
import {
  BOTTOM_NAV,
  isNavActive,
  NAV_GROUPS,
  TOP_NAV,
  type NavGroup,
  type NavLinkItem,
} from "./nav-config";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LogOutIcon,
} from "./sidebar-icons";

const SIDEBAR_EXPANDED = "260px";
const SIDEBAR_COLLAPSED = "72px";
const STORAGE_KEY = "one-venue-sidebar-collapsed";

function readCollapsedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

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
}: {
  item: NavLinkItem;
  collapsed: boolean;
  active: boolean;
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
        <NextLink href={item.href} aria-current={active ? "page" : undefined}>
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
      <NextLink href={item.href} aria-current={active ? "page" : undefined}>
        <Icon aria-hidden />
        <Text truncate>{item.label}</Text>
      </NextLink>
    </Box>
  );
}

function SidebarGroupCollapsed({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  return (
    <Stack gap={1}>
      {group.items.map((item) => (
        <SidebarLink
          key={item.href}
          item={item}
          collapsed
          active={isNavActive(pathname, item.href)}
        />
      ))}
    </Stack>
  );
}

function SidebarGroupExpanded({
  group,
  pathname,
  defaultOpen,
}: {
  group: NavGroup;
  pathname: string;
  defaultOpen: boolean;
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
}: {
  group: NavGroup;
  collapsed: boolean;
  pathname: string;
  defaultOpen: boolean;
}) {
  if (collapsed) {
    return <SidebarGroupCollapsed group={group} pathname={pathname} />;
  }

  return (
    <SidebarGroupExpanded group={group} pathname={pathname} defaultOpen={defaultOpen} />
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const [animateWidth, setAnimateWidth] = useState(false);

  const toggleCollapsed = () => {
    setAnimateWidth(true);
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const width = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;
  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : (user?.email?.split("@")[0] ?? "User");

  return (
    <Box
      as="nav"
      aria-label="Main navigation"
      w={width}
      minW={width}
      flexShrink={0}
      transition={animateWidth ? "width 0.2s ease, min-width 0.2s ease" : undefined}
      onTransitionEnd={() => setAnimateWidth(false)}
      bg="blue.700"
      color="white"
      display="flex"
      flexDirection="column"
      minH="100vh"
      borderRightWidth="1px"
      borderColor="blue.800"
    >
      <Flex
        align="center"
        justify={collapsed ? "center" : "space-between"}
        px={3}
        py={4}
        gap={2}
        minH="72px"
      >
        {!collapsed && (
          <Box minW={0}>
            <Text fontWeight="bold" fontSize="md" lineHeight="short">
              One Venue
            </Text>
            <Text fontSize="xs" color="blue.100">
              Hospitality ERP
            </Text>
          </Box>
        )}
        <IconButton
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          variant="ghost"
          size="sm"
          color="blue.50"
          _hover={{ bg: "whiteAlpha.200" }}
          onClick={toggleCollapsed}
          flexShrink={0}
        >
          {collapsed ? <ChevronRightIcon boxSize={4} /> : <ChevronLeftIcon boxSize={4} />}
        </IconButton>
      </Flex>

      <Stack flex="1" gap={1} px={2} py={2} overflowY="auto">
        {TOP_NAV.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={isNavActive(pathname, item.href)}
          />
        ))}

        {NAV_GROUPS.map((group) => (
          <Box key={group.id} mt={2}>
            <SidebarGroup
              group={group}
              collapsed={collapsed}
              pathname={pathname}
              defaultOpen={group.id === "operations"}
            />
          </Box>
        ))}
      </Stack>

      <Stack gap={1} px={2} py={3} borderTopWidth="1px" borderColor="whiteAlpha.200">
        {BOTTOM_NAV.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            active={isNavActive(pathname, item.href)}
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
          </Box>
        )}
      </Flex>
    </Box>
  );
}
