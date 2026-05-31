import { Box, Skeleton } from "@chakra-ui/react";
import { ContentCard } from "./ContentCard";

export function StatCardSkeleton() {
  return (
    <ContentCard p={4}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={3}>
        <Box flex="1">
          <Skeleton height="3" width="60%" mb={2} />
          <Skeleton height="8" width="40%" mb={2} />
          <Skeleton height="3" width="80%" />
        </Box>
        <Skeleton width="10" height="10" borderRadius="md" />
      </Box>
    </ContentCard>
  );
}
