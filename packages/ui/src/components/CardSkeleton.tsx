import { Skeleton, Stack } from "@chakra-ui/react";
import { ContentCard } from "./ContentCard";

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <ContentCard>
      <Stack gap={2}>
        <Skeleton height="5" width="40%" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} height="4" width={i === lines - 1 ? "60%" : "90%"} />
        ))}
      </Stack>
    </ContentCard>
  );
}
