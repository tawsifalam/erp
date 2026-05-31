"use client";

import { ContextBanner } from "@erp/ui";

export function BranchRequiredNotice() {
  return (
    <ContextBanner status="warning" title="Branch required">
      Choose a branch in the header above. Most day-to-day work — reservations, orders, inventory, and
      reports — is scoped to a single branch.
    </ContextBanner>
  );
}
