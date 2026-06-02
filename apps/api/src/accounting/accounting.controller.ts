import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { AccountingService } from "./accounting.service";

@Controller("accounting")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Get("accounts")
  @RequirePermission(Permission.ACCOUNTING_READ)
  accounts(@Tenant() t: TenantContext) {
    return this.accounting.listAccounts(t.organizationId);
  }

  @Post("accounts")
  @RequirePermission(Permission.ACCOUNTING_WRITE)
  createAccount(
    @Tenant() t: TenantContext,
    @Body() body: { code: string; name: string; type: string },
  ) {
    return this.accounting.createAccount(t.organizationId, body);
  }

  @Get("journals")
  @RequirePermission(Permission.ACCOUNTING_READ)
  journals(@Tenant() t: TenantContext) {
    return this.accounting.listJournalEntries(t.organizationId);
  }

  @Get("fiscal-periods")
  @RequirePermission(Permission.ACCOUNTING_READ)
  fiscalPeriods(@Tenant() t: TenantContext) {
    return this.accounting.listFiscalPeriods(t.organizationId);
  }

  @Post("fiscal-periods")
  @RequirePermission(Permission.ACCOUNTING_WRITE)
  createFiscalPeriod(
    @Tenant() t: TenantContext,
    @Body() body: { name: string; startDate: string; endDate: string },
  ) {
    return this.accounting.createFiscalPeriod(t.organizationId, body, t.userId);
  }

  @Patch("fiscal-periods/:id/close")
  @RequirePermission(Permission.ACCOUNTING_WRITE)
  closeFiscalPeriod(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.accounting.closeFiscalPeriod(t.organizationId, id, t.userId);
  }

  @Patch("fiscal-periods/:id/reopen")
  @RequirePermission(Permission.ACCOUNTING_WRITE)
  reopenFiscalPeriod(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.accounting.reopenFiscalPeriod(t.organizationId, id, t.userId);
  }

  @Post("journals/:id/reverse")
  @RequirePermission(Permission.ACCOUNTING_WRITE)
  reverseJournal(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body() body: { entryDate?: string },
  ) {
    return this.accounting.reverseJournalEntry(
      t.organizationId,
      id,
      t.userId,
      body?.entryDate,
    );
  }

  @Post("journals")
  @RequirePermission(Permission.ACCOUNTING_WRITE)
  createJournal(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      lines: { accountId: string; debit: number; credit: number }[];
      referenceType?: string;
      referenceId?: string;
      description?: string;
      entryDate?: string;
    },
  ) {
    return this.accounting.createJournalEntry({
      organizationId: t.organizationId,
      userId: t.userId,
      ...body,
    });
  }
}
