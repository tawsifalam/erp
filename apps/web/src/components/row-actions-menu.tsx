"use client";

import { Button, Menu, Portal } from "@chakra-ui/react";

export type RowActionItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  colorPalette?: string;
  variant?: "outline" | "ghost" | "solid";
};

export function RowActionsMenu({
  items,
  label = "Actions",
}: {
  items: RowActionItem[];
  label?: string;
}) {
  const enabled = items.filter((i) => !i.disabled);
  if (enabled.length === 0) return null;

  return (
    <Menu.Root
      positioning={{ placement: "bottom-end" }}
      onSelect={(details) => {
        const selected = items.find((i) => i.label === details.value);
        if (selected && !selected.disabled) selected.onClick();
      }}
    >
      <Menu.Trigger asChild>
        <Button size="xs" variant="outline" aria-label={label}>
          ⋯
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner zIndex={1450}>
          <Menu.Content minW="10rem">
            {items.map((item) => (
              <Menu.Item
                key={item.label}
                value={item.label}
                disabled={item.disabled}
                colorPalette={item.colorPalette}
              >
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
