"use client";

import { NumberInput, type NumberInputRootProps } from "@chakra-ui/react";

export type AppNumberInputProps = Omit<
  NumberInputRootProps,
  "value" | "onValueChange" | "children" | "defaultValue"
> & {
  value?: string | number;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  width?: string;
  "data-testid"?: string;
  "aria-label"?: string;
};

/**
 * Chakra NumberInput wrapper (stepper + clamping). Uses string values to match existing form state.
 * @see https://chakra-ui.com/docs/components/number-input
 */
export function AppNumberInput({
  value = "",
  onValueChange,
  size = "sm",
  width = "100%",
  placeholder,
  min,
  max,
  step,
  disabled,
  invalid,
  allowMouseWheel,
  formatOptions,
  "data-testid": testId,
  "aria-label": ariaLabel,
  ...rest
}: AppNumberInputProps) {
  const strValue =
    value === "" || value === undefined || value === null ? "" : String(value);

  return (
    <NumberInput.Root
      size={size}
      width={width}
      value={strValue}
      onValueChange={(details) => onValueChange?.(details.value)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      invalid={invalid}
      allowMouseWheel={allowMouseWheel}
      formatOptions={formatOptions}
      spinOnPress={false}
      {...rest}
    >
      <NumberInput.Control />
      <NumberInput.Input
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-testid={testId}
      />
    </NumberInput.Root>
  );
}
