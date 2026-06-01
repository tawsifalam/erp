import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { ProcurementService } from "./procurement.service";

@Controller("procurement")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class ProcurementController {
  constructor(private readonly procurement: ProcurementService) {}

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
    return this.procurement.createVendor(t.organizationId, body);
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
    return this.procurement.updateVendor(t.organizationId, id, body);
  }

  @Get("purchase-orders")
  @RequirePermission(Permission.INVENTORY_READ)
  listPurchaseOrders(@Tenant() t: TenantContext) {
    return this.procurement.listPurchaseOrders(t.branchId!);
  }

  @Get("purchase-orders/:id")
  @RequirePermission(Permission.INVENTORY_READ)
  getPurchaseOrder(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.procurement.getPurchaseOrder(t.branchId!, id);
  }

  @Post("purchase-orders")
  @RequirePermission(Permission.INVENTORY_WRITE)
  createPurchaseOrder(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      vendorId: string;
      expectedDate?: string;
      notes?: string;
      lines: { inventoryItemId: string; quantity: number; unitPrice: number }[];
    },
  ) {
    return this.procurement.createPurchaseOrder({
      organizationId: t.organizationId,
      branchId: t.branchId!,
      ...body,
    });
  }

  @Post("purchase-orders/:id/submit")
  @RequirePermission(Permission.INVENTORY_WRITE)
  submitPurchaseOrder(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.procurement.submitPurchaseOrder(t.branchId!, id);
  }

  @Post("purchase-orders/:id/receive")
  @RequirePermission(Permission.INVENTORY_WRITE)
  receiveGoods(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body() body: { purchaseOrderLineId: string; quantity: number },
  ) {
    return this.procurement.receiveGoods({
      organizationId: t.organizationId,
      branchId: t.branchId!,
      purchaseOrderId: id,
      purchaseOrderLineId: body.purchaseOrderLineId,
      quantity: body.quantity,
    });
  }
}
