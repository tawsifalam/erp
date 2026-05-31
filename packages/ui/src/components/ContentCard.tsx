import { Box } from "@chakra-ui/react";
import type { ComponentProps, ReactNode } from "react";

export function ContentCard({
  children,
  p = 4,
  ...rest
}: {
  children: ReactNode;
  p?: number | string;
} & Omit<ComponentProps<typeof Box>, "children" | "p">) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="lg"
      shadow="sm"
      p={p}
      {...rest}
    >
      {children}
    </Box>
  );
}
