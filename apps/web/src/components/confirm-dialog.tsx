"use client";

import { Button, Dialog, Portal, Text } from "@chakra-ui/react";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open && !loading) onCancel();
      }}
      role="alertdialog"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            {description && (
              <Dialog.Body>
                <Text fontSize="sm" color="fg.muted">
                  {description}
                </Text>
              </Dialog.Body>
            )}
            <Dialog.Footer gap={2}>
              <Button variant="outline" onClick={onCancel} disabled={loading}>
                {cancelLabel}
              </Button>
              <Button
                colorPalette="red"
                onClick={onConfirm}
                loading={loading}
                data-testid="confirm-dialog-confirm"
              >
                {confirmLabel}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger disabled={loading} />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
