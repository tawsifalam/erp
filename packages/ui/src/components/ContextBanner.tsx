import { Box, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

type BannerStatus = "info" | "warning" | "success";

const styles: Record<BannerStatus, { bg: string; border: string; color: string }> = {
  info: { bg: "blue.50", border: "blue.200", color: "blue.800" },
  warning: { bg: "orange.50", border: "orange.200", color: "orange.800" },
  success: { bg: "green.50", border: "green.200", color: "green.800" },
};

export function ContextBanner({
  title,
  children,
  status = "info",
  action,
}: {
  title?: string;
  children: ReactNode;
  status?: BannerStatus;
  action?: ReactNode;
}) {
  const palette = styles[status];

  return (
    <Box
      mb={4}
      p={4}
      borderRadius="md"
      borderWidth="1px"
      borderColor={palette.border}
      bg={palette.bg}
      display="flex"
      alignItems="flex-start"
      justifyContent="space-between"
      gap={4}
      flexWrap="wrap"
    >
      <Box minW={0}>
        {title && (
          <Text fontWeight="semibold" fontSize="sm" color={palette.color} mb={title && children ? 1 : 0}>
            {title}
          </Text>
        )}
        <Text fontSize="sm" color={palette.color}>
          {children}
        </Text>
      </Box>
      {action}
    </Box>
  );
}
