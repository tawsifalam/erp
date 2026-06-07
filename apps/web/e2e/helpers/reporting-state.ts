import { recordNotification } from "./notification-state";

const MOCK_ORG_A = "org-test-001";
const MOCK_BRANCH_A1 = "branch-test-001";

type MockReportJob = {
  id: string;
  organizationId: string;
  branchId?: string | null;
  type: string;
  status: string;
  fileUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

const REPORT_TYPES = [
  { code: "branch_summary", label: "Branch summary", requiresBranch: true },
  { code: "low_stock", label: "Low stock items", requiresBranch: true },
  { code: "revenue_today", label: "Today's revenue (POS)", requiresBranch: true },
  { code: "trial_balance", label: "Trial balance", requiresBranch: false, requiresAsOf: true, supportsPdf: true },
  { code: "profit_and_loss", label: "Profit & loss", requiresBranch: false, requiresDateRange: true, supportsPdf: true },
  { code: "balance_sheet", label: "Balance sheet", requiresBranch: false, requiresAsOf: true, supportsPdf: true },
  {
    code: "general_ledger",
    label: "General ledger",
    requiresBranch: false,
    requiresDateRange: true,
    requiresAccountCode: true,
    supportsPdf: true,
  },
];

const INITIAL_JOBS: MockReportJob[] = [
  {
    id: "rpt_001",
    organizationId: MOCK_ORG_A,
    branchId: MOCK_BRANCH_A1,
    type: "branch_summary",
    status: "COMPLETED",
    fileUrl: "https://example.com/report.csv",
    createdAt: "2026-05-28T14:00:00Z",
    completedAt: "2026-05-28T14:01:00Z",
  },
];

let reportJobs = structuredClone(INITIAL_JOBS) as MockReportJob[];

export function resetReportingState() {
  reportJobs = structuredClone(INITIAL_JOBS) as MockReportJob[];
}

export function getReportJobs(organizationId?: string) {
  const rows = reportJobs.map((j) => ({ ...j }));
  if (!organizationId) return rows;
  return rows.filter((j) => j.organizationId === organizationId);
}

export function handleReportingMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
  organizationId?: string,
): unknown {
  if (url.includes("/reporting/types") && method === "GET") {
    return REPORT_TYPES.map((t) => ({ ...t }));
  }

  if (url.includes("/reporting/jobs") && method === "GET") {
    return getReportJobs(organizationId);
  }

  if (url.includes("/reporting/export") && method === "POST") {
    const type = String(body?.type ?? "branch_summary");
    const format = (body?.format as string) ?? "csv";
    const isPdf = format === "pdf";
    const job: MockReportJob = {
      id: `rpt_${reportJobs.length + 1}`,
      organizationId: organizationId ?? MOCK_ORG_A,
      branchId: body?.branchId ? String(body.branchId) : MOCK_BRANCH_A1,
      type: type === "summary" ? "branch_summary" : type,
      status: "COMPLETED",
      fileUrl: isPdf ? "https://example.com/report-new.pdf" : "https://example.com/report-new.csv",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    reportJobs.unshift(job);
    recordNotification({
      type: "REPORT_READY",
      title: "Report ready",
      body: `Your ${job.type.replace(/_/g, " ")} export is ready to download.`,
      link: "/reports",
    });
    return { id: job.id, type: job.type, status: "PENDING" };
  }

  return {};
}
