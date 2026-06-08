# Authentication Migration Tracker

**Project:** Hospitality ERP (One Venue)  
**Migration:** PropelAuth → First-party JWT authentication  
**Status:** Complete  
**Last updated:** 2026-06-08  
**Owner:** Engineering  

---

## Executive summary

| Field | Value |
|-------|--------|
| **Decision** | Replace PropelAuth with first-party auth (JWT + Redis refresh sessions) |
| **Rationale** | External dependency caused production login failures; ERP already owns orgs, roles, and onboarding |
| **Production users** | None — full cutover without dual-run or password migration |
| **Target** | All auth flows on `app.one-venue.com` without PropelAuth |
| **Permanent guide** | [auth.md](./auth.md) |

---

## Progress dashboard

| Phase | Description | Status |
|-------|-------------|--------|
| A | Schema + types (`passwordHash`, remove PropelAuth IDs) | Done |
| B | API auth module (login, register, refresh, JWT guard) | Done |
| C | Tenants / invites (Resend, accept-invite) | Done |
| D | Web auth layer (forms, AuthContext, middleware) | Done |
| E | Infrastructure (env, nginx, CI, deploy scripts) | Done |
| F | Tests (unit, integration, E2E, smoke-local) | Done |
| G | Documentation sweep | Done |

### Verification gates

- [x] `pnpm --filter @erp/api test` — unit specs green
- [ ] `RUN_INTEGRATION=1 pnpm --filter @erp/api test:integration`
- [x] `pnpm test:e2e` — mocked auth flows (auth.spec.ts verified)
- [ ] `pnpm smoke:local` — real stack without PropelAuth
- [ ] Manual: register → onboarding → dashboard
- [ ] Manual: admin invite → accept-invite → role home
- [x] VPS deploy: login with JWT only

---

## VPS incident findings (PropelAuth)

Investigation date: 2026-06-07. Documented for audit and to justify migration.

| Symptom | Finding | Ruled out |
|---------|---------|-----------|
| 500 on `/api/auth/callback` | PropelAuth SDK `POST .../propelauth/ssr/token` returned **401** | Nginx routing |
| `incorrect PROPELAUTH_API_KEY` in web logs | Token exchange rejected Bearer key | Empty env in container |
| Login worked locally, failed on VPS | Docker reads `/opt/erp/.env` only, not `apps/web/.env.local` | Cloudflare outage |
| `PROPELAUTH_*` in web container | Correct: redirect URI, verifier, 96-char key | Wrong nginx path |
| `NEXT_PUBLIC_*` in `.env` | Correct production URLs | Missing Go Live |
| `wget` to propelauthtest.com from web container | Exit 0 — outbound OK | Network firewall |
| `curl` token test with fake `code` | **HTTP 401** — key invalid for Test project `3479393695` | Stale web image alone |

**Conclusion:** PropelAuth rejected the API key at token exchange. Infrastructure (host nginx, Docker, env injection) was correct. ERP tenant model does not require PropelAuth org sync.

---

## Current vs target architecture

### Before (PropelAuth)

```
Browser → PropelAuth hosted UI → /api/auth/callback (Next.js SDK)
       → __pa_at cookie → API validates external JWT (propelAuthUserId)
```

### After (first-party)

```
Browser → /auth/login (email + password) → POST /api/auth/login
       → access JWT (memory) + erp_refresh cookie (httpOnly, Redis-backed)
       → JwtAuthGuard (sub = User.id) → TenantGuard
```

---

## Scope

### In scope (v1)

- Email/password register, login, logout, refresh
- Forgot / reset password (Resend)
- Team email invites with accept-invite flow
- JWT access tokens + Redis refresh sessions
- All guards, web UI, tests, deployment docs

### Out of scope (v1)

- SSO, MFA, social login
- PropelAuth org mirror (`propelAuthOrgId`, member sync)
- Dual-run / feature flags

---

## Environment variables

| Before (remove) | After (add) |
|-----------------|-------------|
| `PROPELAUTH_AUTH_URL` | `JWT_ACCESS_SECRET` |
| `PROPELAUTH_API_KEY` | `JWT_REFRESH_SECRET` |
| `PROPELAUTH_VERIFIER_KEY` | `JWT_ACCESS_TTL` (default `15m`) |
| `PROPELAUTH_REDIRECT_URI` | `JWT_REFRESH_TTL` (default `30d`) |
| `NEXT_PUBLIC_AUTH_URL` | `AUTH_COOKIE_NAME` (default `erp_refresh`) |
| `SMOKE_PROPELAUTH_USER_ID` | `SMOKE_USER_EMAIL` + `SMOKE_USER_PASSWORD` |

---

## Test matrix

| Layer | Location | Coverage |
|-------|----------|----------|
| Unit — API | `apps/api/src/auth/*.spec.ts`, `jwt-auth.guard.spec.ts` | password, token, session, guard, auth.service |
| Unit — tenants | `tenants.service.spec.ts` | invite without PropelAuth |
| Integration | `auth.integration.spec.ts` | register, login, refresh, logout, reset, 401 |
| E2E mocked | `apps/web/e2e/auth.spec.ts` | login, register, forgot/reset, accept-invite, logout, onboarding gate |
| Smoke-local | `scripts/smoke-local-setup.mjs` | `POST /auth/login` |
| Production | `production-smoke-runbook.md` P3, §1 | email login, ERP invite |

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| XSS stealing access token | Short TTL; in-memory only; httpOnly refresh cookie |
| Session fixation | Rotate refresh on login |
| Invite token leak | Signed JWT, 7d TTL, single-use on accept |
| Email delivery | Resend (same as notifications); log when unset |

---

## Sign-off

| Gate | Approver | Date | Pass |
|------|----------|------|------|
| Staging smoke | | | ☐ |
| Production deploy | | 2026-06-08 | ☑ |
| PropelAuth decommissioned | | 2026-06-08 | ☑ |

---

## Related documents

- [auth.md](./auth.md) — permanent authentication guide
- [organization-onboarding.md](./organization-onboarding.md)
- [cloud-deployment.md](./cloud-deployment.md)
- [smoke-local.md](./smoke-local.md)
- [production-smoke-runbook.md](./production-smoke-runbook.md)
