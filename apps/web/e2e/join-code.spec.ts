import { test, expect } from "@playwright/test";
import { mockApplicantApiRoutes, mockAuthApplicant } from "./helpers/applicant-auth";
import {
  APPLICANT_EMAIL,
  E2E_JOIN_CODE,
  resetJoinRequestState,
  seedPendingJoinRequest,
} from "./helpers/join-request-state";
import { setupE2ePage } from "./helpers/setup";

test.describe("Join code — applicant", () => {
  test.beforeEach(async ({ page }) => {
    resetJoinRequestState();
    await mockAuthApplicant(page);
    await mockApplicantApiRoutes(page);
  });

  test("submits join request via code and lands on pending page", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByText("Welcome to One Venue")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("tab", { name: "Join organization" }).click();
    await page.getByPlaceholder("ov_xxxxxxxx").fill(E2E_JOIN_CODE);
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.getByText("Boulevard")).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Request to join" }).click();
    await expect(page).toHaveURL(/\/onboarding\/pending/, { timeout: 10_000 });
    await expect(page.getByText(/Waiting for approval/i)).toBeVisible();
  });
});

test.describe("Join code — admin approval", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2ePage(page);
    seedPendingJoinRequest();
  });

  test("admin approves pending join request on team tab", async ({ page }) => {
    await page.goto("/settings?tab=team");
    await expect(page.getByRole("tab", { name: "Team & access", selected: true })).toBeVisible();
    await expect(page.getByText(APPLICANT_EMAIL)).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText(/Join request approved/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("No pending join requests")).toBeVisible({ timeout: 5000 });
  });
});
