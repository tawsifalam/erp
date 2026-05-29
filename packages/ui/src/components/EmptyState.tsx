import { Box, Text } from "@chakra-ui/react";

export function EmptyState({ message }: { message: string }) {
  return (
    <Box py={8} textAlign="center">
      <Text color="fg.muted">{message}</Text>
    </Box>
  );
}
