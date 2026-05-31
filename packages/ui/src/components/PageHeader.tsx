import { Box, Heading, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Box
      mb={6}
      display="flex"
      flexDirection={{ base: "column", sm: "row" }}
      gap={{ base: 3, sm: 0 }}
      justifyContent="space-between"
      alignItems={{ base: "stretch", sm: "flex-start" }}
    >
      <Box>
        <Heading size="lg">{title}</Heading>
        {description && (
          <Text color="fg.muted" mt={1}>
            {description}
          </Text>
        )}
      </Box>
      {actions}
    </Box>
  );
}
