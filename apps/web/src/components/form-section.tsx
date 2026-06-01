"use client";

import { Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Stack gap={4} width="100%">
      <Stack gap={1}>
        <Text fontWeight="semibold" fontSize="sm">
          {title}
        </Text>
        {description && (
          <Text fontSize="xs" color="fg.muted">
            {description}
          </Text>
        )}
      </Stack>
      {children}
    </Stack>
  );
}
