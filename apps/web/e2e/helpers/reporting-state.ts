type MockReportJob = {
  id: string;
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
];

const INITIAL_JOBS: MockReportJob[] = [
  {
    id: "rpt_001",
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

export function getReportJobs() {
  return reportJobs.map((j) => ({ ...j }));
}

export function handleReportingMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  if (url.includes("/reporting/types") && method === "GET") {
    return REPORT_TYPES.map((t) => ({ ...t }));
  }

  if (url.includes("/reporting/jobs") && method === "GET") {
    return getReportJobs();
  }

  if (url.includes("/reporting/export") && method === "POST") {
    const type = String(body?.type ?? "branch_summary");
    const job: MockReportJob = {
      id: `rpt_${reportJobs.length + 1}`,
      type: type === "summary" ? "branch_summary" : type,
      status: "COMPLETED",
      fileUrl: "https://example.com/report-new.csv",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    reportJobs.unshift(job);
    return { id: job.id, type: job.type, status: "PENDING" };
  }

  return {};
}
