type MockAccount = { id: string; code: string; name: string; type: string };

type MockJournal = {
  id: string;
  description?: string;
  createdAt: string;
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
let journals = structuredClone(INITIAL_JOURNALS) as MockJournal[];

export function resetAccountingState() {
  accounts = structuredClone(INITIAL_ACCOUNTS) as MockAccount[];
  journals = structuredClone(INITIAL_JOURNALS) as MockJournal[];
}

export function getAccountingAccounts() {
  return accounts.map((a) => ({ ...a }));
}

export function getAccountingJournals() {
  return journals.map((j) => ({ ...j }));
}

function findAccount(id: string) {
  return accounts.find((a) => a.id === id);
}

export function handleAccountingMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
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
      return entry;
    }
  }

  return {};
}
