"use client";

import { Portal, Select, createListCollection } from "@chakra-ui/react";
import { useMemo } from "react";

const SELECT_POSITIONING = {
  strategy: "fixed" as const,
  hideWhenDetached: true,
  sameWidth: true,
};

export type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type AppSelectProps = {
  items: AppSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  size?: "xs" | "sm" | "md" | "lg";
  width?: string;
  maxWidth?: string;
  minWidth?: string;
  flex?: number | string;
  disabled?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
};

export function AppSelect({
  items,
  value,
  onValueChange,
  placeholder,
  size = "sm",
  width,
  maxWidth,
  minWidth,
  flex,
  disabled,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: AppSelectProps) {
  const collection = useMemo(() => createListCollection({ items }), [items]);

  return (
    <Select.Root
      collection={collection}
      size={size}
      width={width}
      maxW={maxWidth}
      minW={minWidth}
      flex={flex}
      disabled={disabled}
      value={[value]}
      positioning={SELECT_POSITIONING}
      onValueChange={(details) => onValueChange(details.value[0] ?? "")}
    >
      <Select.HiddenSelect aria-label={ariaLabel} data-testid={testId} />
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder={placeholder} />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content maxH="min(50vh, 20rem)" overflowY="auto">
            {collection.items.map((item) => (
              <Select.Item item={item} key={item.value}>
                <Select.ItemText>{item.label}</Select.ItemText>
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  );
}
