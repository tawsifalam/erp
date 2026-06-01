"use client";

import { Button, Dialog, Portal, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export type FormDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  cancelLabel?: string;
};

export function FormDialog({
  open,
  onClose,
  title,
  description,
  children,
  primaryLabel,
  onPrimary,
  primaryLoading = false,
  primaryDisabled = false,
  cancelLabel = "Cancel",
}: FormDialogProps) {
  return (
    <Dialog.Root
      open={open}
      lazyMount
      unmountOnExit
      onOpenChange={(details) => {
        if (!details.open && !primaryLoading) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.500" />
        <Dialog.Positioner zIndex={1500}>
          <Dialog.Content
            bg="white"
            color="gray.900"
            maxW={{ base: "calc(100vw - 2rem)", sm: "md" }}
            mx={4}
          >
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Text fontSize="sm" color="fg.muted" mt={1}>
                  {description}
                </Text>
              )}
              <Dialog.CloseTrigger disabled={primaryLoading} />
            </Dialog.Header>
            <Dialog.Body>{children}</Dialog.Body>
            <Dialog.Footer
              gap={2}
              flexDirection={{ base: "column-reverse", sm: "row" }}
            >
              <Button
                variant="outline"
                width={{ base: "100%", sm: "auto" }}
                disabled={primaryLoading}
                onClick={onClose}
              >
                {cancelLabel}
              </Button>
              <Button
                colorPalette="green"
                width={{ base: "100%", sm: "auto" }}
                loading={primaryLoading}
                disabled={primaryDisabled}
                onClick={onPrimary}
              >
                {primaryLabel}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
