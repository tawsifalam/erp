import { Box, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export function EmptyState({
  message,
  title,
  description,
  action,
  icon,
}: {
  /** Primary message (legacy). Used as title when `title` is omitted. */
  message?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  const heading = title ?? message;
  const body = title ? (description ?? message) : description;

  return (
    <Box py={10} px={4} textAlign="center" maxW="md" mx="auto">
      {icon && (
        <Box
          mx="auto"
          mb={4}
          w="12"
          h="12"
          borderRadius="full"
          bg="gray.100"
          color="gray.500"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="xl"
        >
          {icon}
        </Box>
      )}
      {heading && (
        <Text fontWeight="semibold" fontSize="md" color="fg">
          {heading}
        </Text>
      )}
      {body && (
        <Text color="fg.muted" fontSize="sm" mt={heading ? 2 : 0}>
          {body}
        </Text>
      )}
      {action && <Box mt={4}>{action}</Box>}
    </Box>
  );
}
