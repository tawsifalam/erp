"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSectionTabs, isValidSectionTab } from "@/lib/section-meta";

export function useModuleTab(defaultTab: string): [string, (tab: string) => void] {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const allowedTabs = useMemo(() => getSectionTabs(pathname), [pathname]);

  const tab = useMemo(() => {
    const fromUrl = searchParams.get("tab");
    if (fromUrl && isValidSectionTab(pathname, fromUrl)) return fromUrl;
    if (isValidSectionTab(pathname, defaultTab)) return defaultTab;
    return allowedTabs[0] ?? defaultTab;
  }, [searchParams, pathname, defaultTab, allowedTabs]);

  const setTab = useCallback(
    (next: string) => {
      if (!isValidSectionTab(pathname, next)) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return [tab, setTab];
}
