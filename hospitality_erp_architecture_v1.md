# Hospitality ERP/PMS Technical Design (v1)

## Stack
- Frontend: Next.js + Chakra UI
- Backend: NestJS
- Auth: PropelAuth
- DB: PostgreSQL + Prisma
- Cache: Redis
- Queue: BullMQ
- Realtime: Socket.IO
- Infra: Docker

---

# 1. Monorepo Structure

```txt
apps/
  web/
  api/

packages/
  ui/
  config/
  types/
  utils/

infra/
  docker/
  nginx/

docs/

```

---

# 2. NestJS Real Module Structure

```txt
apps/api/src
├── main.ts
├── app.module.ts
├── common
│   ├── guards
│   ├── decorators
│   ├── interceptors
│   ├── filters
│   ├── pipes
│   └── events
├── config
├── prisma
├── auth
├── tenants
├── users
├── permissions
├── pms
├── pos
├── inventory
├── hr
├── payroll
├── accounting
├── reporting
├── notifications
└── integrations
```

---

# 3. Production Prisma Schema (Core)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                String @id @default(uuid())
  propelAuthUserId  String @unique
  email             String @unique
  name              String?
  createdAt         DateTime @default(now())
  memberships       UserOrganization[]
  employee          Employee?
}

model Organization {
  id               String @id @default(uuid())
  propelAuthOrgId  String @unique
  name             String
  createdAt        DateTime @default(now())
  branches         Branch[]
}

model UserOrganization {
  id              String @id @default(uuid())
  userId          String
  organizationId  String
  role            String

  user User @relation(fields:[userId], references:[id])
  organization Organization @relation(fields:[organizationId], references:[id])

  @@unique([userId, organizationId])
}

model Branch {
  id              String @id @default(uuid())
  organizationId  String
  name            String
  timezone        String

  organization Organization @relation(fields:[organizationId], references:[id])
  rooms Room[]
}

model RoomType {
  id            String @id @default(uuid())
  name          String
  maxAdults     Int
  maxChildren   Int
  rooms         Room[]
}

model Room {
  id            String @id @default(uuid())
  branchId      String
  roomTypeId    String
  roomNumber    String
  status        String
  basePrice     Decimal

  branch Branch @relation(fields:[branchId], references:[id])
  roomType RoomType @relation(fields:[roomTypeId], references:[id])
}

model Guest {
  id          String @id @default(uuid())
  fullName    String
  phone       String?
  email       String?
}

model Reservation {
  id          String @id @default(uuid())
  branchId    String
  guestId     String
  checkIn     DateTime
  checkOut    DateTime
  status      String
  totalAmount Decimal
  paidAmount  Decimal

  guest Guest @relation(fields:[guestId], references:[id])
}

model InventoryItem {
  id            String @id @default(uuid())
  branchId      String
  name          String
  sku           String
  unit          String
}

model InventoryMovement {
  id            String @id @default(uuid())
  itemId        String
  branchId      String
  movementType  String
  quantity      Decimal
  referenceType String
  referenceId   String?
  createdAt     DateTime @default(now())

  item InventoryItem @relation(fields:[itemId], references:[id])
}

model Account {
  id            String @id @default(uuid())
  name          String
  type          String
}

model JournalEntry {
  id            String @id @default(uuid())
  createdAt     DateTime @default(now())
  lines         JournalLine[]
}

model JournalLine {
  id              String @id @default(uuid())
  journalEntryId  String
  accountId       String
  debit           Decimal @default(0)
  credit          Decimal @default(0)

  journalEntry JournalEntry @relation(fields:[journalEntryId], references:[id])
  account Account @relation(fields:[accountId], references:[id])
}

model Employee {
  id          String @id @default(uuid())
  userId      String? @unique
  name        String
  salary      Decimal
  designation String

  user User? @relation(fields:[userId], references:[id])
}
```

---

# 4. PropelAuth Integration

## Next.js Auth

Install:

```bash
npm install @propelauth/nextjs
```

Environment (`.env.local`):

```env
NEXT_PUBLIC_AUTH_URL=https://your-project.propelauth.com
PROPELAUTH_API_KEY=...
PROPELAUTH_VERIFIER_KEY=...
PROPELAUTH_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

Auth routes (`app/api/auth/[slug]/route.ts`):

```ts
import { getRouteHandlers } from "@propelauth/nextjs/server/app-router";

const routeHandlers = getRouteHandlers({
  postLoginRedirectPathFn: () => "/dashboard",
});
export const GET = routeHandlers.getRouteHandler;
export const POST = routeHandlers.postRouteHandler;
```

Wrap app in `AuthProvider`:

```tsx
import { AuthProvider } from "@propelauth/nextjs/client";

<AuthProvider authUrl={process.env.NEXT_PUBLIC_AUTH_URL!}>
  {children}
</AuthProvider>
```

Login: redirect users to `/api/auth/login`.

---

## NestJS Access Token Validation

Install:

```bash
npm install @propelauth/node
```

Initialize:

```ts
import { initBaseAuth } from "@propelauth/node";

const { validateAccessTokenAndGetUserClass } = initBaseAuth({
  authUrl: process.env.PROPELAUTH_AUTH_URL,
  apiKey: process.env.PROPELAUTH_API_KEY,
});
```

Guard:

```ts
const user = await validateAccessTokenAndGetUserClass(
  request.headers.authorization,
);
// user.userId, user.email, user.getOrg(orgId)
```

---

# 5. Event System

Use EventEmitter2.

Install:

```bash
npm install @nestjs/event-emitter
```

Example Event:

```ts
export class OrderCompletedEvent {
  constructor(
    public readonly orderId: string
  ) {}
}
```

Emit:

```ts
this.eventEmitter.emit(
  'order.completed',
  new OrderCompletedEvent(order.id)
)
```

Listener:

```ts
@OnEvent('order.completed')
handleOrderCompleted(event: OrderCompletedEvent) {}
```

---

# 6. Inventory Engine Logic

Inventory is ledger based.

Never store current stock.

Formula:

```txt
Current Stock =
SUM(IN) - SUM(OUT)
```

Order flow:

```txt
Food Sold
→ Recipe Loaded
→ Inventory Movement OUT
→ Accounting Entry
```

Service Example:

```ts
createMovement({
  itemId,
  movementType:'OUT',
  quantity
})
```

Movement Types:
- PURCHASE
- SALE
- WASTE
- STAFF_MEAL
- ADJUSTMENT

---

# 7. Accounting Engine Logic

Double Entry Only.

Rule:

```txt
Debit == Credit
```

Food Sale Example:

```txt
Cash          Dr 500
Revenue           Cr 500
```

Inventory Consumption:

```txt
COGS          Dr 200
Inventory         Cr 200
```

NestJS Example:

```ts
createJournalEntry({
  lines:[]
})
```

Validation:

```ts
if(totalDebit !== totalCredit)
 throw Error()
```

---

# 8. BullMQ Queue Design

Use for:
- Payroll
- Reports
- PDF invoices
- Notifications

Worker:

```ts
@Processor('payroll')
export class PayrollProcessor {}
```

---

# 9. Socket.IO Realtime

Use for:
- Kitchen screen
- Live orders
- Housekeeping

Gateway:

```ts
@WebSocketGateway()
```

---

# 10. MVP Roadmap (Week-by-Week)

## Week 1
- Repo setup
- Docker
- Prisma
- Postgres
- Redis
- PropelAuth setup

## Week 2
- Auth
- Access token validation
- Tenant middleware
- RBAC

## Week 3
- Branch
- Room
- Room type
- Guest CRUD

## Week 4
- Reservation flow
- Availability logic

## Week 5
- POS menu
- Orders
- Kitchen tickets

## Week 6
- Inventory items
- Movements
- Stock calculation

## Week 7
- Recipe/BOM
- Auto deduction

## Week 8
- Accounting
- Journal engine

## Week 9
- HR
- Employee
- Attendance

## Week 10
- Payroll
- Staff meals

## Week 11
- Reporting
- Dashboards
- Analytics

## Week 12
- QA
- Security audit
- Deployment

---

# 11. Recommended Docker Services

```yaml
services:
  web:
  api:
  postgres:
  redis:
  minio:
```

---

# 12. Future Phase

- Offline POS
- Mobile app
- Channel manager
- QR ordering
- Multi-property analytics
