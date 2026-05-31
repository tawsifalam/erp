"use client";

import { useState } from "react";
import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { SidebarNavContent } from "@/components/sidebar-nav-content";
import { ChevronLeftIcon, ChevronRightIcon } from "./sidebar-icons";

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

export function AppSidebar() {
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
      display={{ base: "none", md: "flex" }}
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

      <SidebarNavContent collapsed={collapsed} showBrand={false} />
    </Box>
  );
}
