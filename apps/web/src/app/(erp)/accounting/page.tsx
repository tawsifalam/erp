"use client";

import { useState, useEffect } from "react";
import {
  Badge,
  Button,
  Flex,
  Input,
  Stack,
  Table,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { AppNumberInput } from "@/components/app-number-input";
import { AppSelect } from "@/components/app-select";
import { FormDrawer } from "@/components/form-drawer";
import { FormSection } from "@/components/form-section";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModulePageHeader } from "@/components/module-page-header";
import {
  MoneyText,
  EmptyState,
  FormField,
  ContentCard,
  CardSkeleton,
  TableSkeleton,
  TableScrollArea,
} from "@erp/ui";
import { ScrollableTabsList } from "@/components/scrollable-tabs-list";
import { apiFetch } from "@/lib/api-client";
import { useTenantHeaders } from "@/lib/tenant-context";
import { useAsync } from "@/lib/use-async";
import { useModuleTab } from "@/lib/use-module-tab";
import { formatDateTime } from "@/lib/format";
import { appToast } from "@/lib/app-toast";
import { FiscalPeriodsTab } from "./fiscal-periods-tab";
import { useConfirmDialog } from "@/lib/use-confirm-dialog";

type Account = { id: string; code: string; name: string; type: string };
type Journal = {
  id: string;
  description?: string;
  createdAt: string;
  reversedAt?: string | null;
  reversesEntryId?: string | null;
  lines: { account: { name: string }; debit: string; credit: string }[];
};

type JournalLineForm = { accountId: string; debit: string; credit: string };

export default function AccountingPage() {
  const tenant = useTenantHeaders();
  const { ask, dialog } = useConfirmDialog();
  const [tab, setTab] = useModuleTab("journals");
  const [journalForm, setJournalForm] = useState({
    description: "",
    lines: [{ accountId: "", debit: "", credit: "" }] as JournalLineForm[],
  });
  const [accountForm, setAccountForm] = useState({ code: "", name: "", type: "ASSET" });
  const [journalDrawerOpen, setJournalDrawerOpen] = useState(false);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);

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
      setJournalDrawerOpen(false);
      journalsQuery.reload();
      setTab("journals");
    } catch (e) {
      appToast.error(e instanceof Error ? e.message : "Failed to post journal");
    }
  };

  const reverseJournal = (journal: Journal) => {
    ask({
      title: "Reverse journal entry",
      description: `Create an offsetting entry for "${journal.description ?? journal.id}"? This cannot be undone.`,
      confirmLabel: "Reverse entry",
      onConfirm: async () => {
        try {
          await apiFetch(`/accounting/journals/${journal.id}/reverse`, {
            method: "POST",
            tenant,
            body: JSON.stringify({}),
          });
          appToast.success("Journal entry reversed");
          journalsQuery.reload();
        } catch (e) {
          appToast.error(e instanceof Error ? e.message : "Failed to reverse entry");
        }
      },
    });
  };

  const handleCreateAccount = async () => {
    try {
      await apiFetch("/accounting/accounts", {
        method: "POST",
        tenant,
        body: JSON.stringify(accountForm),
      });
      setAccountForm({ code: "", name: "", type: "ASSET" });
      setAccountDrawerOpen(false);
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
      {dialog}
      <ModulePageHeader />

      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)} mb={4}>
        <ScrollableTabsList>
          <Tabs.List>
            <Tabs.Trigger value="journals">Journal entries</Tabs.Trigger>
            <Tabs.Trigger value="accounts">Chart of accounts</Tabs.Trigger>
            <Tabs.Trigger value="periods">Fiscal periods</Tabs.Trigger>
          </Tabs.List>
        </ScrollableTabsList>

        <Tabs.Content value="journals" pt={4}>
          <Flex gap={2} mb={4} wrap="wrap">
            <Button size="sm" onClick={() => journalsQuery.reload()}>
              Refresh
            </Button>
            <Button
              size="sm"
              colorPalette="blue"
              w={{ base: "full", sm: "auto" }}
              onClick={() => setJournalDrawerOpen(true)}
            >
              + Post journal
            </Button>
          </Flex>
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
                    <Button size="sm" colorPalette="blue" onClick={() => setJournalDrawerOpen(true)}>
                      Post your first entry
                    </Button>
                  }
                />
              )}
              {journals.map((j) => (
                <ContentCard key={j.id} mb={6}>
                  <Flex justify="space-between" align="flex-start" gap={2} mb={2} wrap="wrap">
                    <Text fontWeight="semibold">
                      {j.description ?? j.id} — {formatDateTime(j.createdAt)}
                    </Text>
                    <Flex gap={2} align="center">
                      {j.reversesEntryId && (
                        <Badge colorPalette="purple" size="sm">
                          Reversal
                        </Badge>
                      )}
                      {j.reversedAt && (
                        <Badge colorPalette="gray" size="sm">
                          Reversed
                        </Badge>
                      )}
                      {!j.reversedAt && !j.reversesEntryId && (
                        <Button size="xs" variant="outline" onClick={() => reverseJournal(j)}>
                          Reverse
                        </Button>
                      )}
                    </Flex>
                  </Flex>
                  <TableScrollArea>
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
                  </TableScrollArea>
                </ContentCard>
              ))}
            </>
          )}
        </Tabs.Content>

        <Tabs.Content value="periods" pt={4}>
          <FiscalPeriodsTab />
        </Tabs.Content>

        <Tabs.Content value="accounts" pt={4}>
          <Flex gap={2} mb={4} wrap="wrap">
            <Button size="sm" onClick={() => accountsQuery.reload()}>
              Refresh
            </Button>
            <Button
              size="sm"
              colorPalette="blue"
              w={{ base: "full", sm: "auto" }}
              onClick={() => setAccountDrawerOpen(true)}
            >
              + Add account
            </Button>
          </Flex>
          <ContentCard p={0} overflow="hidden">
            {accountsQuery.loading ? (
              <TableSkeleton rows={5} columns={3} />
            ) : accounts.length === 0 ? (
              <EmptyState
                title="No accounts yet"
                description="Add at least two accounts above before posting journal entries."
              />
            ) : (
              <TableScrollArea>
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
              </TableScrollArea>
            )}
          </ContentCard>
        </Tabs.Content>
      </Tabs.Root>

      <FormDrawer
        open={journalDrawerOpen}
        onClose={() => {
          setJournalDrawerOpen(false);
          setJournalForm({ description: "", lines: [{ accountId: "", debit: "", credit: "" }] });
        }}
        title="Post journal entry"
        description="Double-entry must balance: total debits equal total credits."
        size="lg"
        primaryLabel="Post journal"
        onPrimary={handleCreateJournal}
        primaryDisabled={!journalBalanced}
      >
        <Stack gap={4} width="100%">
          <FormField label="Description" help="Optional memo for this journal entry.">
            <Input
              width="100%"
              placeholder="Description"
              value={journalForm.description}
              onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })}
            />
          </FormField>
          <FormSection title="Lines">
            {journalForm.lines.map((line, i) => (
              <Flex key={i} gap={2} direction={{ base: "column", sm: "row" }} width="100%" mb={3}>
                <FormField label="Account" help={i === 0 ? "Ledger account for this line." : undefined}>
                  <AppSelect
                    width="100%"
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
                <FormField label="Debit">
                  <AppNumberInput
                    min={0}
                    value={line.debit}
                    onValueChange={(v) => updateLine(i, { debit: v })}
                  />
                </FormField>
                <FormField label="Credit">
                  <AppNumberInput
                    min={0}
                    value={line.credit}
                    onValueChange={(v) => updateLine(i, { credit: v })}
                  />
                </FormField>
              </Flex>
            ))}
            <Button size="sm" variant="outline" onClick={addJournalLine}>
              + Line
            </Button>
          </FormSection>
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
        </Stack>
      </FormDrawer>

      <FormDrawer
        open={accountDrawerOpen}
        onClose={() => {
          setAccountDrawerOpen(false);
          setAccountForm({ code: "", name: "", type: "ASSET" });
        }}
        title="Add account"
        size="sm"
        primaryLabel="Create"
        onPrimary={handleCreateAccount}
        primaryDisabled={!accountForm.code.trim() || !accountForm.name.trim()}
      >
        <Stack gap={4} width="100%">
          <FormField label="Code" help="Unique account code (e.g. 1000)." required>
            <Input
              size="sm"
              width="100%"
              placeholder="Code"
              value={accountForm.code}
              onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
            />
          </FormField>
          <FormField label="Name" help="Shown on journal lines." required>
            <Input
              size="sm"
              width="100%"
              placeholder="Name"
              value={accountForm.name}
              onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
            />
          </FormField>
          <FormField
            label="Type"
            help="Asset, Liability, Equity, Revenue, or Expense."
          >
            <AppSelect
              width="100%"
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
        </Stack>
      </FormDrawer>
    </DashboardShell>
  );
}
