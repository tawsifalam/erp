import { Box, Spinner, Text } from "@chakra-ui/react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <Box py={8} display="flex" flexDirection="column" alignItems="center" gap={3}>
      <Spinner size="md" />
      <Text color="fg.muted" fontSize="sm">
        {label}
      </Text>
    </Box>
  );
}
