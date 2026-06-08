import { execFileSync } from "node:child_process";
import path from "node:path";

const REPO_ROOT = path.join(__dirname, "../../../..");

/** Sign invite JWT matching API TokenService (for smoke-local accept-invite). */
export function signSmokeInviteToken(input: {
  inviteId: string;
  organizationId: string;
  email: string;
}): string {
  const script = path.join(REPO_ROOT, "scripts/smoke-sign-invite-token.mjs");
  return execFileSync(
    process.execPath,
    [script, input.inviteId, input.organizationId, input.email],
    {
      cwd: REPO_ROOT,
      env: process.env,
      encoding: "utf8",
    },
  ).trim();
}
