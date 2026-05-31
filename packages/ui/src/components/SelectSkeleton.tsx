import { Skeleton } from "@chakra-ui/react";

export function SelectSkeleton({ width = "180px" }: { width?: string }) {
  return <Skeleton height="9" width={width} borderRadius="md" />;
}
