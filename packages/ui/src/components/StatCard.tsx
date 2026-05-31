import { Box, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { ContentCard } from "./ContentCard";

export function StatCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  icon?: ReactNode;
}) {
  return (
    <ContentCard p={4}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={3}>
        <Box minW={0}>
          <Text fontSize="sm" color="fg.muted" fontWeight="medium">
            {label}
          </Text>
          <Text fontSize="2xl" fontWeight="semibold" mt={1} lineHeight="short">
            {value}
          </Text>
          {helper && (
            <Text fontSize="xs" color="fg.muted" mt={1}>
              {helper}
            </Text>
          )}
        </Box>
        {icon && (
          <Box
            flexShrink={0}
            w="10"
            h="10"
            borderRadius="md"
            bg="blue.50"
            color="blue.600"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            {icon}
          </Box>
        )}
      </Box>
    </ContentCard>
  );
}
