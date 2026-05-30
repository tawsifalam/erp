# SaaS launch guide

How to monetize the hospitality ERP as **multi-tenant B2B SaaS**: what you have today, how to earn revenue now, and what to build for self-serve billing at scale.

Related: [tenant-model.md](./tenant-model.md) (multi-tenancy), [deployment.md](./deployment.md) (production), [erp-completeness-roadmap.md](./erp-completeness-roadmap.md) (product depth for retention).

---

## Executive summary

| Question | Answer |
|----------|--------|
| **SaaS-ready technically?** | Yes — shared DB, org/branch isolation, PropelAuth, deploy path |
| **Can you charge customers today?** | Yes — via **design partners** and manual invoicing |
| **Self-serve SaaS with Stripe?** | Not yet — billing, plan limits, and onboarding funnel are not implemented |
| **Recommended first step** | 2–3 paid pilots → then Stripe + plan enforcement |

**Positioning:** *Integrated hospitality ops platform* — PMS + POS + inventory + basic books for **small properties** (1–3 branches). Not enterprise ERP until [Phase 1.5](./erp-completeness-roadmap.md) ships.

---

## What you already have

| Capability | Location / notes |
|------------|------------------|
| Multi-tenant data model | `Organization` → `Branch`; all modules scoped by IDs |
| Tenant isolation | `TenantGuard` — membership check on `X-Organization-Id` |
| Auth & org mapping | PropelAuth → `User`, `Organization`, `UserOrganization` |
| Org self-provisioning | Settings → create org, default branch, inventory pools |
| RBAC | Roles per org; `@RequirePermission()` on API routes |
| Production topology | Docker, nginx, migrations, health check |

**Architecture:** single deployment, shared PostgreSQL, row-level isolation by `organizationId` (and `branchId` for branch-scoped data). Standard pattern for early-stage B2B SaaS.

---

## Go-to-market paths

### Path A — Design partners (fastest, recommended first)

**Timeline:** 2–4 weeks to first revenue

1. Target 2–3 local hotels or hotel+restaurant properties
2. Deploy one production instance (see [deployment.md](./deployment.md))
3. Create their org manually or via Settings; onboard in a call
4. Charge monthly via bank transfer / invoice (no Stripe required)
5. Collect feedback; prioritize [ERP roadmap](./erp-completeness-roadmap.md) items they ask for

**Pricing example (manual):**

| Tier | Scope | Suggested monthly |
|------|-------|-------------------|
| Pilot | 1 branch, ≤15 rooms, email support | Negotiated (e.g. ৳5,000–15,000 or $49–99) |
| Early adopter | 2–3 branches | 20% discount for 12-month commit + logo/testimonial |

**Exit criteria for Path B:** 3+ customers live 60+ days, churn understood, support load manageable.

---

### Path B — Micro-SaaS (Stripe + tiers)

**Timeline:** 4–8 weeks after Path A validation

1. Marketing landing page + signup
2. Stripe Checkout / Customer Portal
3. Plan limits enforced in API (see [Plan enforcement](#plan-enforcement))
4. Self-serve trial (14 days) → paid conversion
5. In-app onboarding checklist

---

### Path C — Full self-serve SaaS

**Timeline:** 3–6+ months

Path B plus: automated provisioning, status page, GDPR export/delete, Phase 1.5 finance modules, channel manager (Phase 2). Compete on features, not just integration.

---

## Pricing models

Choose one primary metric; optional secondary cap.

| Model | Example | Pros |
|-------|---------|------|
| **Per branch / month** | $79 / branch | Simple; matches your tenant model |
| **Per room / month** | $5 / room | Familiar to PMS buyers |
| **Tiered bundles** | Starter / Pro / Group | Easy upsell; gate features |

### Suggested tiers (starting point)

| Plan | Branches | Rooms (total) | Users | Modules | Price (USD/mo) |
|------|----------|---------------|-------|---------|----------------|
| **Starter** | 1 | 20 | 5 | PMS, POS, Inventory | $79 |
| **Pro** | 3 | 60 | 15 | + Accounting, HR, Reports | $199 |
| **Group** | 10 | 200 | 50 | All + priority support | $499 |

Adjust for local market (BDT annual prepay often works well in South Asia).

**Add-ons (later):** extra branch, payroll runs, CSV report packs, OTA channel (Phase 2).

---

## Launch checklists

### Technical (before taking any payment)

- [ ] Production deploy with HTTPS ([deployment.md](./deployment.md))
- [ ] Automated DB backups (daily) + tested restore
- [ ] `GET /api/health` monitored (UptimeRobot, Better Stack, etc.)
- [ ] Redis + MinIO/S3 production credentials secured
- [ ] PropelAuth production URLs and redirect URIs configured
- [ ] Tenant isolation review — every write path filters by `organizationId`
- [ ] Per-org **data export** script or admin endpoint (JSON/CSV)
- [ ] Error logging (Sentry or similar) with org ID in context
- [ ] Rate limiting on auth and public endpoints

### Commercial (before self-serve signup)

- [ ] Pricing page (even if “Contact us” for Path A)
- [ ] Terms of Service + Privacy Policy
- [ ] Support channel (email / WhatsApp) and response SLA stated
- [ ] Invoice template or Stripe billing
- [ ] Refund / cancellation policy
- [ ] Data processing agreement template (for EU or corporate clients)

### Product (retention)

- [ ] Onboarding checklist in app (branch → rooms → menu → first reservation)
- [ ] “Getting started” doc or video for front desk + kitchen
- [ ] Communicate roadmap ([erp-completeness-roadmap.md](./erp-completeness-roadmap.md)) so buyers know what’s coming
- [ ] One clear wedge: *room folio + F&B + kitchen + stock in one system*

---

## Billing implementation (not built yet)

This section is the **target design** for Path B. No billing code exists in the repo today.

### Proposed schema

Add to `Organization` (or separate `Subscription` table for history):

```prisma
model Organization {
  // ... existing fields ...

  planId              String   @default("trial")   // starter | pro | group | trial
  subscriptionStatus  String   @default("trialing") // trialing | active | past_due | canceled
  stripeCustomerId    String?  @unique
  stripeSubscriptionId String? @unique
  trialEndsAt         DateTime?
  currentPeriodEnd    DateTime?
}
```

Optional `Plan` table for limits (or config file for v1):

```prisma
model Plan {
  id              String @id   // starter, pro, group
  name            String
  maxBranches     Int
  maxRooms        Int
  maxUsers        Int
  stripePriceId   String?      // Stripe Price ID
  modules         String[]     // or JSON: ["pms","pos",...]
}
```

### Stripe flow

```
Landing → Sign up (PropelAuth) → POST /billing/checkout { planId }
  → Stripe Checkout Session (mode: subscription)
  → Webhook: checkout.session.completed
      → Set Organization.stripeCustomerId, subscriptionStatus=active, planId
  → Webhook: customer.subscription.updated | deleted
      → Sync subscriptionStatus, currentPeriodEnd
  → Webhook: invoice.payment_failed
      → subscriptionStatus=past_due → grace period → read-only or lock
```

**Env vars (future):**

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
```

**NestJS module (future):** `apps/api/src/billing/` — controller (checkout, portal), service, Stripe webhook guard (signature verify).

**PropelAuth:** keep auth separate; link Stripe `customer.email` to PropelAuth user email. Org owner completes checkout; subscription attaches to ERP `Organization.id`.

---

## Plan enforcement

Enforce limits **server-side**; UI shows upgrade prompts only as a hint.

| Action | Check | HTTP if over limit |
|--------|-------|---------------------|
| `POST /tenants/branches` | `branchCount < plan.maxBranches` | `402 Payment Required` or `403` |
| `POST /pms/rooms` | total rooms in org `< plan.maxRooms` | same |
| `POST /tenants/organizations` (invite) / add member | `userCount < plan.maxUsers` | same |
| Module routes (e.g. `/hr/*`) | `plan.modules` includes `hr` | `403` with upgrade message |

**Implementation sketch:**

```ts
// billing/plan-limits.service.ts
async assertCanAddBranch(orgId: string) {
  const org = await this.prisma.organization.findUnique({ where: { id: orgId }, include: { branches: true, _count: { select: { memberships: true } } } });
  const plan = this.plans.get(org.planId);
  if (org.subscriptionStatus === "canceled") throw new ForbiddenException("Subscription inactive");
  if (org.branches.length >= plan.maxBranches) throw new ForbiddenException("Branch limit reached");
}
```

**Guard option:** `@RequirePlan("pro")` decorator on controllers, similar to `@RequirePermission()`.

**Trial:** `planId=trial`, `trialEndsAt = now + 14 days`. Cron or middleware sets `past_due` / blocks writes after expiry.

**Webhook → app:** Stripe Customer Portal for self-serve upgrade/cancel (no custom billing UI needed for v1).

---

## Signup & onboarding funnel

### Path A (manual)

1. Sales call → create org in Settings or seed script
2. Send PropelAuth invite (PropelAuth dashboard or API)
3. 1-hour onboarding call: branch, rooms, menu, test reservation + order

### Path B (self-serve)

```
propelauth.com/signup → /dashboard
  → If no org: /onboarding
      Step 1: Property name + timezone
      Step 2: First branch
      Step 3: Stripe checkout (or start trial)
      Step 4: Checklist (rooms, menu, CoA seed)
  → /dashboard
```

**PropelAuth org creation:** align `propelAuthOrgId` on signup with `TenantsService.createOrganization` so default branch + inventory pools are seeded (same as Settings today).

---

## Who will pay vs who won’t (Phase 1)

| Good fit | Poor fit (for now) |
|----------|-------------------|
| 1–3 branch hotel or café+rooms | Large chains needing procurement + statutory GL |
| Wants PMS + POS + stock unified | POS-only restaurant (Toast/Square comparison) |
| Spreadsheet / legacy PMS escapee | Needs OTA channel manager day one |
| Owner-operator willing to pilot | Requires payroll → GL and audited financials |

**Differentiator to sell:** one system for front desk, kitchen, and stock — with journals when they complete orders and check-outs.

---

## Security & compliance (SaaS baseline)

| Topic | Phase 1 action |
|-------|----------------|
| **Tenant isolation** | Audit all Prisma queries use `organizationId` from `request.tenant` |
| **Secrets** | No keys in repo; use env / secret manager |
| **Backups** | Daily Postgres; test restore quarterly |
| **GDPR / delete** | Document process; implement org export + delete before EU customers |
| **Audit trail** | [Roadmap 1.6a](./erp-completeness-roadmap.md#16a-audit-trail--user-administration) — required for corporate buyers |
| **SOC 2** | Not required for SMB pilots; revisit at 20+ enterprise customers |

---

## Metrics to track

| Metric | Why |
|--------|-----|
| **MRR / paying orgs** | Revenue |
| **Trial → paid conversion** | Pricing/fit |
| **Churn (logo + revenue)** | Product/market |
| **WAU per org** | Engagement |
| **Time to first reservation + first order** | Onboarding quality |
| **Support tickets / org / month** | Scalability |

---

## Suggested timeline

| Week | Milestone |
|------|-----------|
| 1–2 | Production deploy; legal docs; outreach to 5 prospects |
| 3–4 | 1–2 paying pilots (manual billing) |
| 5–8 | Fix pilot blockers; second customer |
| 9–12 | Stripe + `Organization` subscription fields + branch limit |
| 13+ | Self-serve signup; marketing site |

Product depth in parallel: [Phase 1.5](./erp-completeness-roadmap.md) when pilots ask for procurement or financial reports.

---

## Related docs

- [Tenant model](./tenant-model.md) — org/branch headers and RBAC
- [PropelAuth](./propelauth.md) — auth setup
- [Deployment](./deployment.md) — production stack
- [ERP completeness roadmap](./erp-completeness-roadmap.md) — product depth for retention and upsell
- [Phase 2 backlog](./phase2/README.md) — OTA, mobile, offline POS (competitive, not launch-blocking)
