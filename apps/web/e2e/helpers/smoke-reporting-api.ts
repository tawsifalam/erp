import type { APIRequestContext } from "@playwright/test";
import { SMOKE_REPORT_JOB_TIMEOUT } from "./smoke-constants";
import { smokeApiBase } from "./smoke-auth-api";
import type { SmokeAuth } from "./smoke-setup";

type ReportJob = {
  id: string;
  status: string;
  errorMessage?: string | null;
};

function tenantHeaders(auth: SmokeAuth) {
  return {
    Authorization: `Bearer ${auth.accessToken}`,
    "X-Organization-Id": auth.organizationId,
    "X-Branch-Id": auth.branchId,
  };
}

/** Poll until a report job completes or fails (BullMQ + MinIO). */
export async function waitForSmokeReportJob(
  request: APIRequestContext,
  auth: SmokeAuth,
  jobId: string,
  timeoutMs = SMOKE_REPORT_JOB_TIMEOUT,
): Promise<ReportJob> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await request.get(`${smokeApiBase}/api/reporting/jobs`, {
      headers: tenantHeaders(auth),
    });
    if (!res.ok()) {
      throw new Error(`GET /api/reporting/jobs failed (${res.status()}): ${await res.text()}`);
    }
    const jobs = (await res.json()) as ReportJob[];
    const job = jobs.find((j) => j.id === jobId);
    if (job?.status === "COMPLETED") return job;
    if (job?.status === "FAILED") {
      const hint =
        job.errorMessage?.includes("storage") || job.errorMessage?.includes("MinIO")
          ? " Start MinIO: docker compose -f infra/docker/docker-compose.yml up -d minio"
          : "";
      throw new Error(`Report export failed: ${job.errorMessage ?? "unknown error"}.${hint}`);
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }

  throw new Error(
    `Report export timed out after ${timeoutMs}ms (job ${jobId}). Check Redis and MinIO are running.`,
  );
}
