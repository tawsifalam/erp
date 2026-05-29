import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { PermissionGuard } from "../common/guards/permission.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { Tenant } from "../common/decorators/tenant.decorator";
import { Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { PmsService } from "./pms.service";
import { AvailabilityService } from "./availability.service";

@Controller("pms")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class PmsController {
  constructor(
    private readonly pms: PmsService,
    private readonly availability: AvailabilityService,
  ) {}

  @Get("branches")
  @RequirePermission(Permission.PMS_READ)
  branches(@Tenant() t: TenantContext) {
    return this.pms.listBranches(t.organizationId);
  }

  @Post("branches")
  @RequirePermission(Permission.PMS_WRITE)
  createBranch(
    @Tenant() t: TenantContext,
    @Body() body: { name: string; timezone: string },
  ) {
    return this.pms.createBranch(t.organizationId, body);
  }

  @Get("room-types")
  @RequirePermission(Permission.PMS_READ)
  roomTypes(@Tenant() t: TenantContext) {
    return this.pms.listRoomTypes(t.organizationId);
  }

  @Post("room-types")
  @RequirePermission(Permission.PMS_WRITE)
  createRoomType(
    @Tenant() t: TenantContext,
    @Body() body: { name: string; maxAdults: number; maxChildren: number },
  ) {
    return this.pms.createRoomType(t.organizationId, body);
  }

  @Get("rooms")
  @RequirePermission(Permission.PMS_READ)
  rooms(@Tenant() t: TenantContext, @Query("branchId") branchId: string) {
    return this.pms.listRooms(branchId || t.branchId!);
  }

  @Post("rooms")
  @RequirePermission(Permission.PMS_WRITE)
  createRoom(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      branchId: string;
      roomTypeId: string;
      roomNumber: string;
      basePrice: number;
    },
  ) {
    return this.pms.createRoom(body.branchId || t.branchId!, body);
  }

  @Get("guests")
  @RequirePermission(Permission.PMS_READ)
  guests(@Tenant() t: TenantContext) {
    return this.pms.listGuests(t.organizationId);
  }

  @Post("guests")
  @RequirePermission(Permission.PMS_WRITE)
  createGuest(
    @Tenant() t: TenantContext,
    @Body() body: { fullName: string; phone?: string; email?: string },
  ) {
    return this.pms.createGuest(t.organizationId, body);
  }

  @Get("reservations")
  @RequirePermission(Permission.PMS_READ)
  reservations(@Query("branchId") branchId: string, @Tenant() t: TenantContext) {
    return this.pms.listReservations(branchId || t.branchId!);
  }

  @Post("reservations")
  @RequirePermission(Permission.PMS_WRITE)
  createReservation(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      branchId: string;
      guestId: string;
      roomId: string;
      checkIn: string;
      checkOut: string;
      totalAmount: number;
    },
  ) {
    return this.pms.createReservation(body.branchId || t.branchId!, {
      ...body,
      checkIn: new Date(body.checkIn),
      checkOut: new Date(body.checkOut),
    });
  }

  @Get("availability")
  @RequirePermission(Permission.PMS_READ)
  getAvailability(
    @Query("branchId") branchId: string,
    @Query("checkIn") checkIn: string,
    @Query("checkOut") checkOut: string,
    @Query("roomTypeId") roomTypeId: string | undefined,
    @Tenant() t: TenantContext,
  ) {
    return this.availability.findAvailableRooms({
      branchId: branchId || t.branchId!,
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      roomTypeId,
    });
  }

  @Patch("reservations/:id/check-in")
  @RequirePermission(Permission.PMS_WRITE)
  checkIn(@Param("id") id: string, @Query("branchId") branchId: string, @Tenant() t: TenantContext) {
    return this.pms.checkIn(id, branchId || t.branchId!);
  }

  @Patch("reservations/:id/check-out")
  @RequirePermission(Permission.PMS_WRITE)
  checkOut(@Param("id") id: string, @Query("branchId") branchId: string, @Tenant() t: TenantContext) {
    return this.pms.checkOut(id, branchId || t.branchId!);
  }

  @Patch("reservations/:id/cancel")
  @RequirePermission(Permission.PMS_WRITE)
  cancel(@Param("id") id: string, @Query("branchId") branchId: string, @Tenant() t: TenantContext) {
    return this.pms.cancelReservation(id, branchId || t.branchId!);
  }
}
