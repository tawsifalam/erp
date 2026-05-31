import { Skeleton, Stack } from "@chakra-ui/react";

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Stack gap={3}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height="4" width={i % 2 === 0 ? "100%" : "85%"} />
      ))}
    </Stack>
  );
}
