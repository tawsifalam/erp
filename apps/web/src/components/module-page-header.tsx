"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@erp/ui";
import { getModuleMeta } from "@/lib/module-meta";
import type { ReactNode } from "react";

export function ModulePageHeader({
  actions,
  title,
  description,
}: {
  actions?: ReactNode;
  title?: string;
  description?: string;
}) {
  const pathname = usePathname();
  const meta = getModuleMeta(pathname);

  return (
    <PageHeader
      title={title ?? meta?.title ?? "One Venue"}
      description={description ?? meta?.description}
      actions={actions}
    />
  );
}
