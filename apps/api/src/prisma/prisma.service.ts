import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { generateId, getModelPrefix } from "@erp/utils";

function assignPrefixedId(model: string, data: Record<string, unknown>): void {
  if (!data) return;
  const prefix = getModelPrefix(model);
  if (!prefix) return;
  // Only assign if no id yet OR if the existing id lacks the correct prefix
  if (!data.id || !(data.id as string).startsWith(`${prefix}_`)) {
    data.id = generateId(model);
  }
}

function withIdGeneration(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          assignPrefixedId(model, args.data as Record<string, unknown>);
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (Array.isArray(args.data)) {
            for (const item of args.data) {
              assignPrefixedId(model, item as Record<string, unknown>);
            }
          }
          return query(args);
        },
        async createManyAndReturn({ model, args, query }) {
          if (Array.isArray(args.data)) {
            for (const item of args.data) {
              assignPrefixedId(model, item as Record<string, unknown>);
            }
          }
          return query(args);
        },
        async upsert({ model, args, query }) {
          assignPrefixedId(model, args.create as Record<string, unknown>);
          return query(args);
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof withIdGeneration>;

/** Transaction client type for interactive transactions */
export type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly _client: ExtendedPrismaClient;

  constructor() {
    this._client = withIdGeneration(new PrismaClient());
  }

  async onModuleInit(): Promise<void> {
    await this._client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this._client.$disconnect();
  }

  // ─── Model Delegates ────────────────────────────────────────────────────────
  get user() { return this._client.user; }
  get organization() { return this._client.organization; }
  get userOrganization() { return this._client.userOrganization; }
  get organizationJoinRequest() { return this._client.organizationJoinRequest; }
  get organizationInvite() { return this._client.organizationInvite; }
  get branch() { return this._client.branch; }
  get roomType() { return this._client.roomType; }
  get ratePlan() { return this._client.ratePlan; }
  get rateRule() { return this._client.rateRule; }
  get room() { return this._client.room; }
  get guest() { return this._client.guest; }
  get reservation() { return this._client.reservation; }
  get menuCategory() { return this._client.menuCategory; }
  get menuItem() { return this._client.menuItem; }
  get order() { return this._client.order; }
  get orderLine() { return this._client.orderLine; }
  get kitchenTicket() { return this._client.kitchenTicket; }
  get inventoryPool() { return this._client.inventoryPool; }
  get inventoryItem() { return this._client.inventoryItem; }
  get inventoryMovement() { return this._client.inventoryMovement; }
  get recipe() { return this._client.recipe; }
  get recipeLine() { return this._client.recipeLine; }
  get account() { return this._client.account; }
  get journalEntry() { return this._client.journalEntry; }
  get journalLine() { return this._client.journalLine; }
  get fiscalPeriod() { return this._client.fiscalPeriod; }
  get vendorPayment() { return this._client.vendorPayment; }
  get employee() { return this._client.employee; }
  get attendanceRecord() { return this._client.attendanceRecord; }
  get payrollRun() { return this._client.payrollRun; }
  get payrollLine() { return this._client.payrollLine; }
  get staffMeal() { return this._client.staffMeal; }
  get staffMealRecipe() { return this._client.staffMealRecipe; }
  get staffMealRecipeLine() { return this._client.staffMealRecipeLine; }
  get inclusionRecipe() { return this._client.inclusionRecipe; }
  get inclusionRecipeLine() { return this._client.inclusionRecipeLine; }
  get inclusionPackage() { return this._client.inclusionPackage; }
  get inclusionPackageRule() { return this._client.inclusionPackageRule; }
  get reservationAllowance() { return this._client.reservationAllowance; }
  get inclusionConsumption() { return this._client.inclusionConsumption; }
  get auditLog() { return this._client.auditLog; }
  get notification() { return this._client.notification; }
  get notificationPreference() { return this._client.notificationPreference; }
  get userBranch() { return this._client.userBranch; }
  get reportJob() { return this._client.reportJob; }
  get vendor() { return this._client.vendor; }
  get purchaseOrder() { return this._client.purchaseOrder; }
  get purchaseOrderLine() { return this._client.purchaseOrderLine; }
  get goodsReceipt() { return this._client.goodsReceipt; }

  // ─── Client Methods ─────────────────────────────────────────────────────────
  $transaction<P extends Prisma.PrismaPromise<unknown>[]>(
    arg: [...P],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<{ [K in keyof P]: Awaited<P[K]> }>;
  $transaction<R>(
    fn: (prisma: TransactionClient) => Promise<R>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<R>;
  $transaction(...args: unknown[]): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this._client.$transaction as (...a: unknown[]) => Promise<unknown>)(...args);
  }

  $connect(): Promise<void> {
    return this._client.$connect();
  }

  $disconnect(): Promise<void> {
    return this._client.$disconnect();
  }
}
