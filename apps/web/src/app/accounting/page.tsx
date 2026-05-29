"use client";

import { useEffect, useState } from "react";
import { Box, Table } from "@chakra-ui/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader, MoneyText } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";

type Journal = {
  id: string;
  description?: string;
  createdAt: string;
  lines: { account: { name: string }; debit: string; credit: string }[];
};

export default function AccountingPage() {
  const tenant = useTenantHeaders();
  const [journals, setJournals] = useState<Journal[]>([]);

  useEffect(() => {
    apiFetch<Journal[]>("/accounting/journals", { tenant }).then(setJournals).catch(console.error);
  }, [tenant.organizationId]);

  return (
    <DashboardShell title="Accounting">
      <PageHeader title="Journal entries" description="Double-entry ledger (read-only MVP)" />
      <Box bg="white" borderRadius="md" p={4}>
        {journals.map((j) => (
          <Box key={j.id} mb={6} borderBottomWidth="1px" pb={4}>
            <Box fontWeight="semibold" mb={2}>
              {j.description ?? j.id.slice(0, 8)} — {new Date(j.createdAt).toLocaleString()}
            </Box>
            <Table.Root size="sm">
              <Table.Body>
                {j.lines.map((l, i) => (
                  <Table.Row key={i}>
                    <Table.Cell>{l.account.name}</Table.Cell>
                    <Table.Cell>
                      {Number(l.debit) > 0 && <MoneyText amount={Number(l.debit)} />}
                    </Table.Cell>
                    <Table.Cell>
                      {Number(l.credit) > 0 && <MoneyText amount={Number(l.credit)} />}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        ))}
      </Box>
    </DashboardShell>
  );
}
