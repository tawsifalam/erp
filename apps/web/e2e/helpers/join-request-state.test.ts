import { beforeEach, describe, expect, it } from "vitest";
import {
  APPLICANT_USER_ID,
  E2E_JOIN_CODE,
  handleJoinRequestMutation,
  resetJoinRequestState,
} from "./join-request-state";

describe("join-request-state", () => {
  beforeEach(() => {
    resetJoinRequestState();
  });

  it("requires organizationId or joinCode on create", () => {
    const result = handleJoinRequestMutation("POST", "/api/tenants/join-requests", {}, APPLICANT_USER_ID);
    expect(result).toMatchObject({ status: 400, message: /organizationId or joinCode is required/ });
  });

  it("rejects unknown organizationId on create", () => {
    const result = handleJoinRequestMutation(
      "POST",
      "/api/tenants/join-requests",
      { organizationId: "org-unknown-999" },
      APPLICANT_USER_ID,
    );
    expect(result).toMatchObject({ status: 404, message: /Organization not found/ });
  });

  it("resolves joinCode to organization on create", () => {
    const result = handleJoinRequestMutation(
      "POST",
      "/api/tenants/join-requests",
      { joinCode: E2E_JOIN_CODE },
      APPLICANT_USER_ID,
    );
    expect(result).toMatchObject({
      organizationId: "org-test-001",
      status: "PENDING",
      userId: APPLICANT_USER_ID,
    });
  });
});
