# PropelAuth integration

## Dashboard setup

1. Create a project at [PropelAuth](https://www.propelauth.com).
2. Under **Frontend Integration**, set:
   - Default redirect after login: `/dashboard` (or rely on `postLoginRedirectPathFn`)
   - Default redirect after logout: `/`
3. Under **Backend Integration**, copy:
   - Auth URL → `NEXT_PUBLIC_AUTH_URL` / `PROPELAUTH_AUTH_URL`
   - API key → `PROPELAUTH_API_KEY`
   - Verifier key (single line) → `PROPELAUTH_VERIFIER_KEY` (web, optional on API)

## Web (`apps/web`)

- `@propelauth/nextjs` handles `/api/auth/login`, `/api/auth/logout`, `/api/auth/callback`, `/api/auth/access_token`
- `AuthProvider` wraps the app in `src/components/providers.tsx`
- `middleware.ts` keeps sessions fresh
- Login page redirects to `/api/auth/login`

## API (`apps/api`)

- `@propelauth/node` validates `Authorization: Bearer <token>` via `PropelAuthGuard`
- On first visit, dashboard calls `POST /api/auth/sync` to upsert `User` and `Organization` from PropelAuth IDs

## Org mapping

- PropelAuth org ID → `Organization.propelAuthOrgId`
- PropelAuth user ID → `User.propelAuthUserId`
- ERP `X-Organization-Id` header uses internal UUID; link orgs at sync time

## Local env files

Copy root `.env.example` to `.env` and `apps/web/.env.local` for Next.js-specific keys.
