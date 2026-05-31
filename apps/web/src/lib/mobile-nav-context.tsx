"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Box, IconButton, Portal } from "@chakra-ui/react";
import { SidebarNavContent } from "@/components/sidebar-nav-content";
import { MenuIcon } from "@/components/sidebar-icons";

type MobileNavContextValue = {
  open: boolean;
  openNav: () => void;
  closeNav: () => void;
};

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const openNav = useCallback(() => setOpen(true), []);
  const closeNav = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNav();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeNav]);

  return (
    <MobileNavContext.Provider value={{ open, openNav, closeNav }}>
      {children}
      {open && (
        <Portal>
          <Box position="fixed" inset={0} zIndex={1500} display={{ base: "block", md: "none" }}>
            <Box
              position="absolute"
              inset={0}
              bg="blackAlpha.600"
              onClick={closeNav}
              aria-hidden
            />
            <Box
              as="nav"
              aria-label="Mobile navigation"
              position="absolute"
              left={0}
              top={0}
              bottom={0}
              w="280px"
              maxW="85vw"
              bg="blue.700"
              color="white"
              display="flex"
              flexDirection="column"
              shadow="xl"
            >
              <SidebarNavContent onNavigate={closeNav} />
            </Box>
          </Box>
        </Portal>
      )}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) {
    throw new Error("useMobileNav must be used within MobileNavProvider");
  }
  return ctx;
}

export function MobileNavButton() {
  const { openNav } = useMobileNav();

  return (
    <IconButton
      aria-label="Open navigation menu"
      title="Open menu"
      variant="outline"
      size="sm"
      display={{ base: "inline-flex", md: "none" }}
      onClick={openNav}
      flexShrink={0}
    >
      <MenuIcon boxSize={4} />
    </IconButton>
  );
}
