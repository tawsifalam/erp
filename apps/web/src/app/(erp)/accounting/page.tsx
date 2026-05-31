"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Table,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { AppSelect } from "@/components/app-select";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePageHeader } from "@/components/module-page-header";
import { MoneyText, EmptyState, LoadingState } from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";
import { useAsync } from "@/lib/use-async";
import { formatDateTime } from "@/lib/format";
import { appToast } from "@/lib/app-toast";

type Account = { id: string; code: string; name: string; type: string };
type Journal = {
  id: string;
  description?: string;
  createdAt: string;
  lines: { account: { name: string }; debit: string; credit: string }[];
};

type JournalLineForm = { accountId: string; debit: string; credit: string };

export default function AccountingPage() {
  const tenant = useTenantHeaders();
  const [tab, setTab] = useState("journals");
  const [journalForm, setJournalForm] = useState({
    description: "",
    lines: [{ accountId: "", debit: "", credit: "" }] as JournalLineForm[],
  });
  const [accountForm, setAccountForm] = useState({ code: "", name: "", type: "ASSET" });

  const accountsQuery = useAsync(
    () => apiFetch<Account[]>("/accounting/accounts", { tenant }),
    [tenant.organizationId],
  );

  const journalsQuery = useAsync(
    () => apiFetch<Journal[]>("/accounting/journals", { tenant }),
    [tenant.organizationId],
  );

  useEffect(() => {
    if (journalsQuery.error) appToast.error(journalsQuery.error);
  }, [journalsQuery.error]);

  const addJournalLine = () => {
    setJournalForm((f) => ({
      ...f,
      lines: [...f.lines, { accountId: "", debit: "", credit: "" }],
    }));
  };

  const updateLine = (index: number, patch: Partial<JournalLineForm>) => {
    setJournalForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  };

  const handleCreateJournal = async () => {
    const lines = journalForm.lines
      .filter((l) => l.accountId)
      .map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      }));

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (lines.length < 2) {
      appToast.error("At least two lines with accounts are required.");
      return;
    }
    if (totalDebit !== totalCredit) {
      appToast.error(`Entry not balanced: debits ${totalDebit} ≠ credits ${totalCredit}`);
      return;
    }

    try {
      await apiFetch("/accounting/journals", {
        method: "POST",
        tenant,
        body: JSON.stringify({
          description: journalForm.description || undefined,
          lines,
        }),
      });
      setJournalForm({ description: "", lines: [{ accountId: "", debit: "", credit: "" }] });
      journalsQuery.reload();
      setTab("journals");
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to post journal");
    }
  };

  const handleCreateAccount = async () => {
    await apiFetch("/accounting/accounts", {
      method: "POST",
      tenant,
      body: JSON.stringify(accountForm),
    });
    setAccountForm({ code: "", name: "", type: "ASSET" });
    accountsQuery.reload();
  };

  const accounts = accountsQuery.data ?? [];
  const journals = journalsQuery.data ?? [];

  const journalTotals = journalForm.lines.reduce(
    (acc, l) => ({
      debit: acc.debit + (Number(l.debit) || 0),
      credit: acc.credit + (Number(l.credit) || 0),
    }),
    { debit: 0, credit: 0 },
  );
  const journalBalanced =
    journalTotals.debit === journalTotals.credit && journalTotals.debit > 0;

  return (
    <DashboardShell>
      <ModulePageHeader />

      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)} mb={4}>
        <Tabs.List>
          <Tabs.Trigger value="journals">Journal entries</Tabs.Trigger>
          <Tabs.Trigger value="accounts">Chart of accounts</Tabs.Trigger>
          <Tabs.Trigger value="new-journal">New journal</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="journals" pt={4}>
          {journalsQuery.loading && <LoadingState />}
          {!journalsQuery.loading && journals.length === 0 && (
            <EmptyState message="No journal entries yet." />
          )}
          {journals.map((j) => (
            <Box key={j.id} mb={6} bg="white" borderRadius="md" p={4}>
              <Text fontWeight="semibold" mb={2}>
                {j.description ?? j.id} — {formatDateTime(j.createdAt)}
              </Text>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Account</Table.ColumnHeader>
                    <Table.ColumnHeader>Debit</Table.ColumnHeader>
                    <Table.ColumnHeader>Credit</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
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
        </Tabs.Content>

        <Tabs.Content value="accounts" pt={4}>
          <Box bg="white" borderRadius="md" p={4} mb={4}>
            <Text fontWeight="semibold" mb={3}>
              Add account
            </Text>
            <Flex gap={2} wrap="wrap" align="flex-end">
              <Input
                size="sm"
                w="100px"
                placeholder="Code"
                value={accountForm.code}
                onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
              />
              <Input
                size="sm"
                w="200px"
                placeholder="Name"
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
              />
              <AppSelect
                width="140px"
                items={[
                  { value: "ASSET", label: "Asset" },
                  { value: "LIABILITY", label: "Liability" },
                  { value: "EQUITY", label: "Equity" },
                  { value: "REVENUE", label: "Revenue" },
                  { value: "EXPENSE", label: "Expense" },
                ]}
                value={accountForm.type}
                onValueChange={(v) => setAccountForm({ ...accountForm, type: v })}
              />
              <Button size="sm" colorPalette="blue" onClick={handleCreateAccount}>
                Add
              </Button>
            </Flex>
          </Box>
          {accountsQuery.loading && <LoadingState />}
          <Box bg="white" borderRadius="md" p={4}>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Code</Table.ColumnHeader>
                  <Table.ColumnHeader>Name</Table.ColumnHeader>
                  <Table.ColumnHeader>Type</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {accounts.map((a) => (
                  <Table.Row key={a.id}>
                    <Table.Cell fontFamily="mono">{a.code}</Table.Cell>
                    <Table.Cell>{a.name}</Table.Cell>
                    <Table.Cell>{a.type}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        </Tabs.Content>

        <Tabs.Content value="new-journal" pt={4}>
          <Box bg="white" borderRadius="md" p={4}>
            <Stack gap={3}>
              <Input
                placeholder="Description"
                value={journalForm.description}
                onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })}
              />
              {journalForm.lines.map((line, i) => (
                <Flex key={i} gap={2} wrap="wrap">
                  <AppSelect
                    flex={1}
                    minWidth="200px"
                    items={[
                      { value: "", label: "Account" },
                      ...accounts.map((a) => ({
                        value: a.id,
                        label: `${a.code} — ${a.name}`,
                      })),
                    ]}
                    value={line.accountId}
                    onValueChange={(v) => updateLine(i, { accountId: v })}
                    placeholder="Account"
                  />
                  <Input
                    size="sm"
                    w="100px"
                    type="number"
                    placeholder="Debit"
                    value={line.debit}
                    onChange={(e) => updateLine(i, { debit: e.target.value })}
                  />
                  <Input
                    size="sm"
                    w="100px"
                    type="number"
                    placeholder="Credit"
                    value={line.credit}
                    onChange={(e) => updateLine(i, { credit: e.target.value })}
                  />
                </Flex>
              ))}
              <Flex gap={4} align="center" wrap="wrap" fontSize="sm">
                <Text>
                  Debits: <strong>{journalTotals.debit.toFixed(2)}</strong>
                </Text>
                <Text>
                  Credits: <strong>{journalTotals.credit.toFixed(2)}</strong>
                </Text>
                <Text color={journalBalanced ? "green.600" : "orange.600"}>
                  {journalBalanced ? "Balanced ✓" : "Not balanced"}
                </Text>
              </Flex>
              <Flex gap={2}>
                <Button size="sm" variant="outline" onClick={addJournalLine}>
                  + Line
                </Button>
                <Button size="sm" colorPalette="green" onClick={handleCreateJournal}>
                  Post journal entry
                </Button>
              </Flex>
            </Stack>
          </Box>
        </Tabs.Content>
      </Tabs.Root>
    </DashboardShell>
  );
}
