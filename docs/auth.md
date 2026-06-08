# Authentication

One Venue ERP uses **first-party JWT authentication** — no external auth SaaS. The Nest API owns login, sessions, password reset, and organization invites.

## Architecture

| Layer | Responsibility |
|-------|----------------|
| **API** (`apps/api/src/auth/`) | Register, login, refresh, logout, forgot/reset password, accept invite |
| **Web** (`apps/web/src/lib/auth-context.tsx`) | `AuthProvider`, login forms, access token cache for `apiFetch` |
| **Middleware** (`apps/web/src/middleware.ts`) | Redirects unauthenticated users when `erp_refresh` cookie is missing |
| **Redis** | Refresh session storage + rotation |
| **PostgreSQL** | `User.passwordHash` |

### Token flow

1. User submits email + password on `/auth/login`.
2. API verifies `passwordHash`, stores refresh session in Redis, returns JSON `{ accessToken, user }` and sets httpOnly `erp_refresh` cookie.
3. Browser calls protected API routes with `Authorization: Bearer <accessToken>`.
4. `JwtAuthGuard` validates JWT (`sub` = internal `User.id`); `TenantGuard` loads ERP membership.
5. `AuthProvider` calls `POST /api/auth/refresh` on load to obtain a fresh access token from the cookie.

Access tokens default to **15 minutes**; refresh tokens default to **30 days**.

## Environment variables

Set in repo root `.env` (API) and build-time `NEXT_PUBLIC_*` for web:

```env
JWT_ACCESS_SECRET=...          # min 16 characters
JWT_REFRESH_SECRET=...
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
AUTH_COOKIE_NAME=erp_refresh
APP_URL=http://localhost:3000  # invite + reset links
CORS_ORIGIN=http://localhost:3000
```

Web only needs:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional transactional email (invites, password reset):

```env
RESEND_API_KEY=re_...
EMAIL_FROM=ERP <notifications@yourdomain.com>
```

## Local development

After `pnpm db:reset`, a demo user is seeded:

| Field | Value |
|-------|-------|
| Email | `admin@boulevard.cafe` |
| Password | `DemoPassword1!` |

1. Start infra: `docker compose up -d postgres redis minio`
2. `pnpm db:reset`
3. `pnpm dev`
4. Open http://localhost:3000/auth/login

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Email + password → tokens |
| POST | `/api/auth/refresh` | Cookie | Rotate refresh, new access token |
| POST | `/api/auth/logout` | Cookie | Revoke refresh session |
| POST | `/api/auth/forgot-password` | — | Send reset email |
| POST | `/api/auth/reset-password` | — | Set new password |
| GET | `/api/auth/invite/:token` | — | Invite preview |
| POST | `/api/auth/accept-invite` | — | Accept invite + set password |
| POST | `/api/auth/sync` | JWT | Onboarding status after login |
| POST | `/api/auth/me` | JWT | Current user claims |

All auth routes are served by the **Nest API**. Nginx should proxy `/api/` to the API container only (no Next.js auth proxy).

## Organization invites

Admins invite from **Settings → Team & access**. The API:

1. Creates `OrganizationInvite` in Postgres.
2. Signs a short-lived invite JWT.
3. Sends email via Resend with link `/auth/accept-invite?token=...`.

Recipient sets a password; API creates or links the user and adds org membership.

## Production checklist

- [ ] Generate strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (≥ 32 random bytes each).
- [ ] Set `APP_URL` and `CORS_ORIGIN` to production domain.
- [ ] Configure Resend (`RESEND_API_KEY`, verified `EMAIL_FROM`).
- [ ] Ensure host nginx proxies all `/api/*` to the API service.
- [ ] Run production smoke: login → dashboard → invite flow ([production-smoke-runbook.md](./production-smoke-runbook.md)).

## Testing

| Suite | Command |
|-------|---------|
| API unit | `pnpm --filter @erp/api test` |
| API integration | `RUN_INTEGRATION=1 pnpm --filter @erp/api test:integration` |
| Web E2E (mocked) | `pnpm test:e2e` |
| Real-stack smoke | `pnpm smoke:local:setup && pnpm smoke:local` |

Smoke setup uses `SMOKE_USER_EMAIL` / `SMOKE_USER_PASSWORD` (defaults to seeded demo user). See [smoke-local.md](./smoke-local.md).

## Migration note

PropelAuth was removed in favor of this stack. Historical investigation and rollout status: [auth-migration.md](./auth-migration.md).
