import { Box } from "@chakra-ui/react";
import type { ComponentProps, ReactNode } from "react";

/** Horizontal scroll wrapper for data tables on narrow viewports. */
export function TableScrollArea({
  children,
  ...rest
}: { children: ReactNode } & Omit<ComponentProps<typeof Box>, "children">) {
  return (
    <Box
      overflowX="auto"
      mx={-1}
      px={1}
      css={{ WebkitOverflowScrolling: "touch" }}
      {...rest}
    >
      {children}
    </Box>
  );
}
