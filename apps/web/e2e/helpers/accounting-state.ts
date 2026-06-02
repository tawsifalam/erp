import { recordAudit } from "./audit-state";

type MockAccount = { id: string; code: string; name: string; type: string };

type MockFiscalPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  closedAt: string | null;
};

type MockJournal = {
  id: string;
  description?: string;
  createdAt: string;
  reversedAt?: string | null;
  reversesEntryId?: string | null;
  lines: { account: { name: string; code?: string }; debit: string; credit: string }[];
};

const INITIAL_ACCOUNTS: MockAccount[] = [
  { id: "acc_1000", code: "1000", name: "Cash", type: "ASSET" },
  { id: "acc_1100", code: "1100", name: "Bank Account", type: "ASSET" },
  { id: "acc_1300", code: "1300", name: "Accounts Receivable", type: "ASSET" },
  { id: "acc_4000", code: "4000", name: "Room Revenue", type: "REVENUE" },
  { id: "acc_4100", code: "4100", name: "F&B Revenue", type: "REVENUE" },
  { id: "acc_5200", code: "5200", name: "Utilities Expense", type: "EXPENSE" },
];

const INITIAL_FISCAL_PERIODS: MockFiscalPeriod[] = [
  {
    id: "fp_demo",
    name: "FY 2026",
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-12-31T23:59:59.999Z",
    status: "OPEN",
    closedAt: null,
  },
];

const INITIAL_JOURNALS: MockJournal[] = [
  {
    id: "je_001",
    description: "Room payment",
    createdAt: "2026-05-28T10:00:00Z",
    lines: [
      { account: { name: "Cash", code: "1000" }, debit: "7000", credit: "0" },
      { account: { name: "Room Revenue", code: "4000" }, debit: "0", credit: "7000" },
    ],
  },
];

let accounts = structuredClone(INITIAL_ACCOUNTS) as MockAccount[];
let fiscalPeriods = structuredClone(INITIAL_FISCAL_PERIODS) as MockFiscalPeriod[];
let journals = structuredClone(INITIAL_JOURNALS) as MockJournal[];

export function resetAccountingState() {
  accounts = structuredClone(INITIAL_ACCOUNTS) as MockAccount[];
  fiscalPeriods = structuredClone(INITIAL_FISCAL_PERIODS) as MockFiscalPeriod[];
  journals = structuredClone(INITIAL_JOURNALS) as MockJournal[];
}

export function getAccountingAccounts() {
  return accounts.map((a) => ({ ...a }));
}

export function getFiscalPeriods() {
  return fiscalPeriods.map((p) => ({ ...p }));
}

export function getAccountingJournals() {
  return journals.map((j) => ({
    ...j,
    reversedAt: j.reversedAt ?? null,
    reversesEntryId: j.reversesEntryId ?? null,
  }));
}

/** Called from procurement mock when a vendor payment is recorded. */
export function recordVendorPaymentJournal(vendorName: string, amount: number) {
  const entry: MockJournal = {
    id: `je_${journals.length + 1}`,
    description: `Vendor payment — ${vendorName}`,
    createdAt: new Date().toISOString(),
    lines: [
      { account: { name: "Accounts Payable", code: "2000" }, debit: String(amount), credit: "0" },
      { account: { name: "Bank Account", code: "1100" }, debit: "0", credit: String(amount) },
    ],
  };
  journals.unshift(entry);
}

function findAccount(id: string) {
  return accounts.find((a) => a.id === id);
}

type PeriodError = { errorStatus: number; message: string };

function resolveOpenPeriod(entryDate: Date): MockFiscalPeriod | PeriodError {
  const day = Date.UTC(
    entryDate.getUTCFullYear(),
    entryDate.getUTCMonth(),
    entryDate.getUTCDate(),
  );
  const match = fiscalPeriods.find((p) => {
    const start = new Date(p.startDate);
    const end = new Date(p.endDate);
    const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    return day >= startDay && day <= endDay;
  });
  if (!match) {
    return {
      errorStatus: 400,
      message: "No fiscal period covers this entry date. Create an open period first.",
    };
  }
  if (match.status !== "OPEN") {
    return {
      errorStatus: 400,
      message: `Fiscal period "${match.name}" is closed. Reopen it or choose another entry date.`,
    };
  }
  return match;
}

function isPeriodError(
  value: MockFiscalPeriod | PeriodError,
): value is PeriodError {
  return "errorStatus" in value;
}

export function handleAccountingMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  if (url.includes("/fiscal-periods")) {
    if (method === "GET") return getFiscalPeriods();

    if (method === "POST") {
      const name = String(body?.name ?? "").trim();
      const startDate = String(body?.startDate ?? "");
      const endDate = String(body?.endDate ?? "");
      if (!name || !startDate || !endDate) {
        return { status: 400, message: "Period name and dates are required" };
      }
      const period: MockFiscalPeriod = {
        id: `fp_${fiscalPeriods.length + 1}`,
        name,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        status: "OPEN",
        closedAt: null,
      };
      fiscalPeriods.unshift(period);
      return period;
    }

    const closeMatch = url.match(/\/fiscal-periods\/([^/]+)\/close/);
    if (method === "PATCH" && closeMatch) {
      const p = fiscalPeriods.find((x) => x.id === closeMatch[1]);
      if (!p) return { status: 404, message: "Fiscal period not found" };
      p.status = "CLOSED";
      p.closedAt = new Date().toISOString();
      return p;
    }

    const reopenMatch = url.match(/\/fiscal-periods\/([^/]+)\/reopen/);
    if (method === "PATCH" && reopenMatch) {
      const p = fiscalPeriods.find((x) => x.id === reopenMatch[1]);
      if (!p) return { status: 404, message: "Fiscal period not found" };
      p.status = "OPEN";
      p.closedAt = null;
      return p;
    }
  }

  if (url.includes("/accounts")) {
    if (method === "GET") return getAccountingAccounts();

    if (method === "POST") {
      const code = String(body?.code ?? "").trim();
      const name = String(body?.name ?? "").trim();
      if (!code || !name) {
        return { status: 400, message: "Account code and name are required" };
      }
      const account: MockAccount = {
        id: `acc_${code}`,
        code,
        name,
        type: String(body?.type ?? "ASSET"),
      };
      accounts.push(account);
      return account;
    }
  }

  if (url.includes("/journals")) {
    if (method === "GET") return getAccountingJournals();

    const reverseMatch = url.match(/\/journals\/([^/]+)\/reverse/);
    if (method === "POST" && reverseMatch) {
      const original = journals.find((j) => j.id === reverseMatch[1]);
      if (!original) return { status: 404, message: "Journal entry not found" };
      if (original.reversesEntryId) {
        return { status: 400, message: "Cannot reverse a reversal entry" };
      }
      if (original.reversedAt) {
        return { status: 400, message: "Journal entry has already been reversed" };
      }
      const reversal: MockJournal = {
        id: `je_${journals.length + 1}`,
        description: `Reversal of: ${original.description ?? original.id}`,
        createdAt: new Date().toISOString(),
        reversesEntryId: original.id,
        lines: original.lines.map((l) => ({
          account: { ...l.account },
          debit: l.credit,
          credit: l.debit,
        })),
      };
      original.reversedAt = new Date().toISOString();
      journals.unshift(reversal);
      recordAudit({
        action: "REVERSE",
        entityType: "journal_entry",
        entityId: original.id,
        metadata: { reversalEntryId: reversal.id },
      });
      return reversal;
    }

    if (method === "POST") {
      const lines = (body?.lines as { accountId: string; debit: number; credit: number }[]) ?? [];
      const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
      if (lines.length < 2) {
        return { status: 400, message: "At least two journal lines required" };
      }
      if (totalDebit !== totalCredit) {
        return {
          status: 400,
          message: `Journal entry not balanced: debit=${totalDebit} credit=${totalCredit}`,
        };
      }

      const entryDate = body?.entryDate ? new Date(String(body.entryDate)) : new Date();
      const periodCheck = resolveOpenPeriod(entryDate);
      if (isPeriodError(periodCheck)) {
        return { status: periodCheck.errorStatus, message: periodCheck.message };
      }

      const entry: MockJournal = {
        id: `je_${journals.length + 1}`,
        description: body?.description ? String(body.description) : undefined,
        createdAt: new Date().toISOString(),
        lines: lines.map((l) => {
          const acc = findAccount(l.accountId);
          return {
            account: { name: acc?.name ?? "Unknown", code: acc?.code },
            debit: String(l.debit || 0),
            credit: String(l.credit || 0),
          };
        }),
      };
      journals.unshift(entry);
      recordAudit({
        action: "CREATE",
        entityType: "journal_entry",
        entityId: entry.id,
        metadata: { lineCount: lines.length },
      });
      return entry;
    }
  }

  return {};
}
