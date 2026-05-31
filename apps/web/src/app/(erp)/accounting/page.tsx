"use client";

import { useState, useEffect } from "react";
import {
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
import {
  MoneyText,
  EmptyState,
  FormField,
  ContentCard,
  CardSkeleton,
  TableSkeleton,
} from "@erp/ui";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";
import { useAsync } from "@/lib/use-async";
import { useModuleTab } from "@/lib/use-module-tab";
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
  const [tab, setTab] = useModuleTab("journals");
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
    try {
      await apiFetch("/accounting/accounts", {
        method: "POST",
        tenant,
        body: JSON.stringify(accountForm),
      });
      setAccountForm({ code: "", name: "", type: "ASSET" });
      accountsQuery.reload();
      appToast.success("Account created");
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to create account");
    }
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
          {journalsQuery.loading ? (
            <Stack gap={4}>
              <CardSkeleton lines={4} />
              <CardSkeleton lines={4} />
            </Stack>
          ) : (
            <>
              {journals.length === 0 && (
                <EmptyState
                  title="No journal entries yet"
                  description="Post a balanced double-entry journal to record revenue, expenses, and transfers."
                  action={
                    <Button size="sm" colorPalette="blue" onClick={() => setTab("new-journal")}>
                      Post your first entry
                    </Button>
                  }
                />
              )}
              {journals.map((j) => (
                <ContentCard key={j.id} mb={6}>
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
                </ContentCard>
              ))}
            </>
          )}
        </Tabs.Content>

        <Tabs.Content value="accounts" pt={4}>
          <ContentCard mb={4}>
            <Text fontWeight="semibold" mb={3}>
              Add account
            </Text>
            <Flex gap={2} wrap="wrap" align="flex-end">
              <FormField label="Code" help="Unique account code (e.g. 1000).">
                <Input
                  size="sm"
                  w="100px"
                  value={accountForm.code}
                  onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                />
              </FormField>
              <FormField label="Name" help="Human-readable name shown on journal lines.">
                <Input
                  size="sm"
                  w="200px"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                />
              </FormField>
              <FormField
                label="Type"
                help="Asset, Liability, Equity, Revenue, or Expense — determines balance sheet vs P&L."
              >
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
              </FormField>
              <Button size="sm" colorPalette="blue" onClick={handleCreateAccount}>
                Add
              </Button>
            </Flex>
          </ContentCard>
          <ContentCard>
            {accountsQuery.loading ? (
              <TableSkeleton rows={5} columns={3} />
            ) : accounts.length === 0 ? (
              <EmptyState
                title="No accounts yet"
                description="Add at least two accounts above before posting journal entries."
              />
            ) : (
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
            )}
          </ContentCard>
        </Tabs.Content>

        <Tabs.Content value="new-journal" pt={4}>
          <ContentCard>
            <Stack gap={3}>
              <FormField label="Description" help="Optional memo for this journal entry.">
                <Input
                  value={journalForm.description}
                  onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })}
                />
              </FormField>
              {journalForm.lines.map((line, i) => (
                <Flex key={i} gap={2} wrap="wrap" align="flex-end">
                  <FormField
                    label={i === 0 ? "Account" : "Account"}
                    help={
                      i === 0
                        ? "Pick the ledger account for this side of the entry."
                        : undefined
                    }
                  >
                    <AppSelect
                      flex={1}
                      minWidth="200px"
                      items={[
                        { value: "", label: "Select account" },
                        ...accounts.map((a) => ({
                          value: a.id,
                          label: `${a.code} — ${a.name}`,
                        })),
                      ]}
                      value={line.accountId}
                      onValueChange={(v) => updateLine(i, { accountId: v })}
                      placeholder="Select account"
                    />
                  </FormField>
                  <FormField
                    label={i === 0 ? "Debit" : "Debit"}
                    help={
                      i === 0
                        ? "Enter amount on one side only — debit or credit, not both."
                        : undefined
                    }
                  >
                    <Input
                      size="sm"
                      w="100px"
                      type="number"
                      value={line.debit}
                      onChange={(e) => updateLine(i, { debit: e.target.value })}
                    />
                  </FormField>
                  <FormField label={i === 0 ? "Credit" : "Credit"}>
                    <Input
                      size="sm"
                      w="100px"
                      type="number"
                      value={line.credit}
                      onChange={(e) => updateLine(i, { credit: e.target.value })}
                    />
                  </FormField>
                </Flex>
              ))}
              <FormField
                label="Balance check"
                help="Total debits must equal total credits. Each line uses either a debit or credit, not both."
              >
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
              </FormField>
              <Flex gap={2}>
                <Button size="sm" variant="outline" onClick={addJournalLine}>
                  + Line
                </Button>
                <Button size="sm" colorPalette="green" onClick={handleCreateJournal}>
                  Post journal entry
                </Button>
              </Flex>
            </Stack>
          </ContentCard>
        </Tabs.Content>
      </Tabs.Root>
    </DashboardShell>
  );
}
