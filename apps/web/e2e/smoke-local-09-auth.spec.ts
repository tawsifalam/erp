/**
 * Real-stack auth: register → onboarding → invite → accept.
 * Does not use seeded admin session from smoke-local:setup.
 */
import { test, expect } from "@playwright/test";
import { SMOKE_TIMEOUT } from "./helpers/smoke-constants";
import {
  smokeApiInviteMember,
  smokeApiListOrganizations,
  smokeApiLogin,
} from "./helpers/smoke-auth-api";
import { signSmokeInviteToken } from "./helpers/smoke-invite-token";
import { smokeSuffix } from "./helpers/smoke-local.harness";

const ownerPassword = "SmokePassword1!";
const inviteePassword = "SmokePassword1!";

let ownerEmail = "";
let orgName = "";
let organizationId = "";
let inviteeEmail = "";

test.describe("Smoke — auth flows", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    () => !!process.env.CI && !process.env.SMOKE_USER_EMAIL,
    "CI smoke job must set SMOKE_USER_EMAIL (see .github/workflows/ci.yml)",
  );

  test("register → onboarding → create organization", async ({ page }) => {
    const suffix = smokeSuffix();
    ownerEmail = `smoke-owner-${suffix}@example.com`;
    orgName = `Smoke Auth Org ${suffix}`;

    await page.goto("/auth/register");
    await page.getByRole("textbox", { name: "Name" }).fill("Smoke Owner");
    await page.getByRole("textbox", { name: "Email" }).fill(ownerEmail);
    await page.getByLabel(/^Password$/i).fill(ownerPassword);
    await page.getByLabel(/Confirm password/i).fill(ownerPassword);
    await page.getByRole("button", { name: /Create account/i }).click();

    await expect(page).toHaveURL(/\/onboarding/, { timeout: SMOKE_TIMEOUT * 3 });
    await expect(page.getByText("Welcome to One Venue")).toBeVisible();

    await page.getByLabel(/Organization name/i).fill(orgName);
    await page.getByRole("button", { name: /Create organization/i }).click();

    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible({
      timeout: SMOKE_TIMEOUT * 3,
    });
  });

  test("owner invites teammate and invitee accepts", async ({ browser, request }) => {
    test.skip(!ownerEmail, "Requires register test");

    inviteeEmail = `smoke-invite-${smokeSuffix()}@example.com`;

    const ownerSession = await smokeApiLogin(request, ownerEmail, ownerPassword);
    const memberships = await smokeApiListOrganizations(request, ownerSession);
    const membership =
      memberships.find((m) => m.organization.name === orgName) ?? memberships[0];
    expect(membership).toBeTruthy();
    organizationId = membership!.organizationId;

    const invite = await smokeApiInviteMember(
      request,
      ownerSession,
      organizationId,
      inviteeEmail,
      "FRONT_DESK",
    );

    const inviteToken = signSmokeInviteToken({
      inviteId: invite.id,
      organizationId,
      email: inviteeEmail,
    });

    const inviteeContext = await browser.newContext();
    const inviteePage = await inviteeContext.newPage();

    await inviteePage.goto(`/auth/accept-invite?token=${encodeURIComponent(inviteToken)}`);
    await expect(inviteePage.getByRole("heading", { name: `Join ${orgName}` })).toBeVisible({
      timeout: SMOKE_TIMEOUT * 2,
    });
    await expect(inviteePage.getByText(inviteeEmail)).toBeVisible();

    await inviteePage.getByRole("textbox", { name: "Your name" }).fill("Smoke Invitee");
    await inviteePage.getByLabel(/^Password$/i).fill(inviteePassword);
    await inviteePage.getByLabel(/Confirm password/i).fill(inviteePassword);
    await inviteePage.getByRole("button", { name: /Accept invite/i }).click();

    await expect(inviteePage.getByRole("navigation", { name: "Main navigation" })).toBeVisible({
      timeout: SMOKE_TIMEOUT * 3,
    });

    await inviteeContext.close();
  });
});
