import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
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
    },
  ) {
    return this.accounting.createJournalEntry({
      organizationId: t.organizationId,
      ...body,
    });
  }
}
