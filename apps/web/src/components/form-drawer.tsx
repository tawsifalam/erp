"use client";

import {
  Button,
  Drawer,
  Portal,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import type { ReactNode } from "react";

const SIZE_MAP = {
  sm: { md: "xs" as const, base: "full" as const },
  md: { md: "md" as const, base: "full" as const },
  lg: { md: "lg" as const, base: "full" as const },
};

export type FormDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  cancelLabel?: string;
  /** Optional extra footer content (left side on desktop) */
  footerExtra?: ReactNode;
};

export function FormDrawer({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  primaryLabel,
  onPrimary,
  primaryLoading = false,
  primaryDisabled = false,
  cancelLabel = "Cancel",
  footerExtra,
}: FormDrawerProps) {
  const showPrimary = Boolean(primaryLabel && onPrimary);
  const placement = useBreakpointValue({ base: "bottom", md: "end" }) as "bottom" | "end";
  const drawerSize = useBreakpointValue(SIZE_MAP[size]) ?? SIZE_MAP.md.md;

  return (
    <Drawer.Root
      open={open}
      placement={placement}
      size={drawerSize}
      lazyMount
      unmountOnExit
      onOpenChange={(details) => {
        if (!details.open && !primaryLoading) onClose();
      }}
    >
      <Portal>
        <Drawer.Backdrop bg="blackAlpha.500" />
        <Drawer.Positioner zIndex={1499}>
          <Drawer.Content
            bg="white"
            color="gray.900"
            maxH={{ base: "92dvh", md: "100dvh" }}
            h={{ base: "92dvh", md: "100dvh" }}
            display="flex"
            flexDirection="column"
            overflow="hidden"
            borderTopRadius={{ base: "lg", md: "0" }}
          >
            <Drawer.Header
              bg="white"
              borderBottomWidth="1px"
              borderColor="gray.200"
              flexShrink={0}
            >
              <Drawer.Title>{title}</Drawer.Title>
              {description && (
                <Drawer.Description>
                  <Text fontSize="sm" color="fg.muted">
                    {description}
                  </Text>
                </Drawer.Description>
              )}
              <Drawer.CloseTrigger disabled={primaryLoading} />
            </Drawer.Header>

            <Drawer.Body
              flex="1"
              minH={0}
              overflowY="auto"
              bg="white"
              p={{ base: 4, md: 6 }}
            >
              {children}
            </Drawer.Body>

            <Drawer.Footer
              bg="white"
              borderTopWidth="1px"
              borderColor="gray.200"
              flexShrink={0}
              gap={2}
              flexDirection={{ base: "column-reverse", sm: "row" }}
              justifyContent={footerExtra ? "space-between" : "flex-end"}
              alignItems={{ base: "stretch", sm: "center" }}
              p={{ base: 4, md: 4 }}
            >
              {footerExtra}
              <Drawer.ActionTrigger asChild>
                <Button
                  variant={showPrimary ? "outline" : "solid"}
                  colorPalette={showPrimary ? undefined : "gray"}
                  width={{ base: "100%", sm: "auto" }}
                  disabled={primaryLoading}
                  onClick={onClose}
                >
                  {showPrimary ? cancelLabel : cancelLabel || "Close"}
                </Button>
              </Drawer.ActionTrigger>
              {showPrimary && (
                <Button
                  colorPalette="green"
                  width={{ base: "100%", sm: "auto" }}
                  loading={primaryLoading}
                  disabled={primaryDisabled}
                  onClick={onPrimary}
                >
                  {primaryLabel}
                </Button>
              )}
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
