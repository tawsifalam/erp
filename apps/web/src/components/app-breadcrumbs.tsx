"use client";

import NextLink from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Box, Text } from "@chakra-ui/react";
import { getModuleMeta } from "@/lib/module-meta";
import { getModulePathname, getSectionMeta } from "@/lib/section-meta";

type BreadcrumbSegment = {
  label: string;
  href?: string;
};

export function buildBreadcrumbSegments(
  pathname: string,
  tab?: string | null,
): BreadcrumbSegment[] {
  if (pathname === "/pos/kitchen") {
    return [
      { label: "POS", href: "/pos" },
      { label: "Kitchen" },
    ];
  }

  const modulePath = getModulePathname(pathname) ?? pathname;
  const meta = getModuleMeta(modulePath);
  const moduleLabel = meta?.label ?? "One Venue";

  const segments: BreadcrumbSegment[] = [{ label: moduleLabel }];

  if (tab) {
    const section = getSectionMeta(pathname, tab);
    if (section) {
      segments.push({ label: section.label });
    }
  }

  return segments;
}

export function AppBreadcrumbs({
  tab: tabOverride,
  segments: segmentsOverride,
}: {
  tab?: string | null;
  segments?: BreadcrumbSegment[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = tabOverride ?? searchParams.get("tab");
  const segments = segmentsOverride ?? buildBreadcrumbSegments(pathname, tab);

  if (segments.length === 0) return null;

  return (
    <Box
      display="flex"
      alignItems="center"
      gap={2}
      flexWrap="wrap"
      data-testid="app-breadcrumbs"
      fontSize="xs"
      color="fg.muted"
      mb={0.5}
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <Box key={`${segment.label}-${index}`} display="flex" alignItems="center" gap={2}>
            {index > 0 && <Text color="gray.400">/</Text>}
            {segment.href && !isLast ? (
              <Box asChild color="blue.600" _hover={{ textDecoration: "underline" }}>
                <NextLink href={segment.href}>{segment.label}</NextLink>
              </Box>
            ) : (
              <Text color={isLast ? "fg" : "fg.muted"} fontWeight={isLast ? "medium" : "normal"}>
                {segment.label}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
