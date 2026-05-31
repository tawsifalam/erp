import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

/** Wraps tab triggers so they scroll horizontally on narrow viewports. */
export function ScrollableTabsList({ children }: { children: ReactNode }) {
  return (
    <Box overflowX="auto" mx={-1} px={1} css={{ WebkitOverflowScrolling: "touch" }}>
      <Box display="inline-flex" minW="min-content">
        {children}
      </Box>
    </Box>
  );
}
