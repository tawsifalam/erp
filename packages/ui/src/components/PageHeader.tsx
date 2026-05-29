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
    <Box mb={6} display="flex" justifyContent="space-between" alignItems="flex-start">
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
