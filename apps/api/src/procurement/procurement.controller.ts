import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { TenantScopeService } from "../common/tenant/tenant-scope.service";
import { ProcurementService } from "./procurement.service";

@Controller("procurement")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class ProcurementController {
  constructor(
    private readonly procurement: ProcurementService,
    private readonly tenantScope: TenantScopeService,
  ) {}

  private resolveBranch(t: TenantContext) {
    return this.tenantScope.resolveBranchId(t);
  }

  @Get("vendors")
  @RequirePermission(Permission.INVENTORY_READ)
  listVendors(@Tenant() t: TenantContext) {
    return this.procurement.listVendors(t.organizationId);
  }

  @Post("vendors")
  @RequirePermission(Permission.INVENTORY_WRITE)
  createVendor(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      name: string;
      contactName?: string;
      email?: string;
      phone?: string;
      paymentTerms?: string;
    },
  ) {
    return this.procurement.createVendor(t.organizationId, body, t.userId);
  }

  @Patch("vendors/:id")
  @RequirePermission(Permission.INVENTORY_WRITE)
  updateVendor(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      paymentTerms?: string;
      isActive?: boolean;
    },
  ) {
    return this.procurement.updateVendor(t.organizationId, id, body, t.userId);
  }

  @Get("purchase-orders")
  @RequirePermission(Permission.INVENTORY_READ)
  async listPurchaseOrders(@Tenant() t: TenantContext) {
    return this.procurement.listPurchaseOrders((await this.resolveBranch(t))!);
  }

  @Get("purchase-orders/:id")
  @RequirePermission(Permission.INVENTORY_READ)
  async getPurchaseOrder(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.procurement.getPurchaseOrder((await this.resolveBranch(t))!, id);
  }

  @Post("purchase-orders")
  @RequirePermission(Permission.INVENTORY_WRITE)
  async createPurchaseOrder(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      vendorId: string;
      expectedDate?: string;
      notes?: string;
      lines: { inventoryItemId: string; quantity: number; unitPrice: number }[];
    },
  ) {
    const branchId = (await this.resolveBranch(t))!;
    return this.procurement.createPurchaseOrder({
      organizationId: t.organizationId,
      branchId,
      userId: t.userId,
      ...body,
    });
  }

  @Post("purchase-orders/:id/submit")
  @RequirePermission(Permission.INVENTORY_WRITE)
  async submitPurchaseOrder(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.procurement.submitPurchaseOrder(
      (await this.resolveBranch(t))!,
      id,
      t.organizationId,
      t.userId,
    );
  }

  @Post("purchase-orders/:id/receive")
  @RequirePermission(Permission.INVENTORY_WRITE)
  async receiveGoods(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body() body: { purchaseOrderLineId: string; quantity: number },
  ) {
    const branchId = (await this.resolveBranch(t))!;
    return this.procurement.receiveGoods({
      organizationId: t.organizationId,
      branchId,
      purchaseOrderId: id,
      purchaseOrderLineId: body.purchaseOrderLineId,
      quantity: body.quantity,
      userId: t.userId,
    });
  }

  @Get("vendor-payments")
  @RequirePermission(Permission.INVENTORY_READ)
  async listVendorPayments(@Tenant() t: TenantContext) {
    return this.procurement.listVendorPayments((await this.resolveBranch(t))!);
  }

  @Get("vendors/:id/ap-balance")
  @RequirePermission(Permission.INVENTORY_READ)
  async vendorApBalance(@Tenant() t: TenantContext, @Param("id") vendorId: string) {
    return this.procurement.getVendorApBalance(
      t.organizationId,
      (await this.resolveBranch(t))!,
      vendorId,
    );
  }

  @Post("vendor-payments")
  @RequirePermission(Permission.ACCOUNTING_WRITE)
  async createVendorPayment(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      vendorId: string;
      amount: number;
      paymentDate?: string;
      payFromAccountCode?: string;
      purchaseOrderId?: string;
      reference?: string;
    },
  ) {
    const branchId = (await this.resolveBranch(t))!;
    return this.procurement.createVendorPayment({
      organizationId: t.organizationId,
      branchId,
      userId: t.userId,
      ...body,
    });
  }
}
