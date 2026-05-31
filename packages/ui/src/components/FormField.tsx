import { Field, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export function FormField({
  label,
  help,
  required,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <Field.Root required={required}>
      <Field.Label fontSize="sm" fontWeight="medium">
        {label}
        {required && (
          <Text as="span" color="red.500" ml={0.5}>
            *
          </Text>
        )}
      </Field.Label>
      {children}
      {help && (
        <Field.HelperText fontSize="xs" color="fg.muted">
          {help}
        </Field.HelperText>
      )}
    </Field.Root>
  );
}
