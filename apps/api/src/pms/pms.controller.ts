import {
  Body,
  Controller,
  Delete,
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
import { ReservationStatus, RoomStatus } from "@erp/types";
import { PmsService } from "./pms.service";
import { AvailabilityService } from "./availability.service";
import { RatePlansService } from "./rate-plans.service";
import { RatePricingService } from "./rate-pricing.service";

@Controller("pms")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class PmsController {
  constructor(
    private readonly pms: PmsService,
    private readonly availability: AvailabilityService,
    private readonly ratePlans: RatePlansService,
    private readonly pricing: RatePricingService,
  ) {}

  private branchId(t: TenantContext, query?: string) {
    return query || t.branchId!;
  }

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

  @Patch("room-types/:id")
  @RequirePermission(Permission.PMS_WRITE)
  updateRoomType(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body() body: { name?: string; maxAdults?: number; maxChildren?: number },
  ) {
    return this.pms.updateRoomType(t.organizationId, id, body);
  }

  @Delete("room-types/:id")
  @RequirePermission(Permission.PMS_WRITE)
  deleteRoomType(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.pms.deleteRoomType(t.organizationId, id);
  }

  @Get("rooms")
  @RequirePermission(Permission.PMS_READ)
  rooms(@Tenant() t: TenantContext, @Query("branchId") branchId: string) {
    return this.pms.listRooms(this.branchId(t, branchId));
  }

  @Get("rooms/:id")
  @RequirePermission(Permission.PMS_READ)
  getRoom(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("branchId") branchId: string,
  ) {
    return this.pms.getRoom(this.branchId(t, branchId), id);
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

  @Patch("rooms/:id")
  @RequirePermission(Permission.PMS_WRITE)
  updateRoom(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("branchId") branchId: string,
    @Body()
    body: {
      roomTypeId?: string;
      roomNumber?: string;
      basePrice?: number;
    },
  ) {
    return this.pms.updateRoom(this.branchId(t, branchId), id, body);
  }

  @Patch("rooms/:id/status")
  @RequirePermission(Permission.PMS_WRITE)
  updateRoomStatus(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("branchId") branchId: string,
    @Body() body: { status: RoomStatus },
  ) {
    return this.pms.updateRoomStatus(this.branchId(t, branchId), id, body.status);
  }

  @Delete("rooms/:id")
  @RequirePermission(Permission.PMS_WRITE)
  deleteRoom(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Query("branchId") branchId: string,
  ) {
    return this.pms.deleteRoom(this.branchId(t, branchId), id);
  }

  @Get("guests")
  @RequirePermission(Permission.PMS_READ)
  guests(@Tenant() t: TenantContext) {
    return this.pms.listGuests(t.organizationId);
  }

  @Get("guests/:id")
  @RequirePermission(Permission.PMS_READ)
  getGuest(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.pms.getGuest(t.organizationId, id);
  }

  @Post("guests")
  @RequirePermission(Permission.PMS_WRITE)
  createGuest(
    @Tenant() t: TenantContext,
    @Body() body: { fullName: string; phone?: string; email?: string },
  ) {
    return this.pms.createGuest(t.organizationId, body);
  }

  @Patch("guests/:id")
  @RequirePermission(Permission.PMS_WRITE)
  updateGuest(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body() body: { fullName?: string; phone?: string; email?: string },
  ) {
    return this.pms.updateGuest(t.organizationId, id, body);
  }

  @Delete("guests/:id")
  @RequirePermission(Permission.PMS_WRITE)
  deleteGuest(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.pms.deleteGuest(t.organizationId, id);
  }

  @Get("reservations")
  @RequirePermission(Permission.PMS_READ)
  reservations(@Query("branchId") branchId: string, @Tenant() t: TenantContext) {
    return this.pms.listReservations(this.branchId(t, branchId));
  }

  @Get("reservations/:id")
  @RequirePermission(Permission.PMS_READ)
  getReservation(
    @Param("id") id: string,
    @Query("branchId") branchId: string,
    @Tenant() t: TenantContext,
  ) {
    return this.pms.getReservation(this.branchId(t, branchId), id);
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
      totalAmount?: number;
      paidAmount?: number;
      status?: ReservationStatus;
      adultCount?: number;
      childCount?: number;
      packageId?: string;
      mealsPerGuestPerNightOverride?: number;
    },
  ) {
    return this.pms.createReservation(body.branchId || t.branchId!, {
      guestId: body.guestId,
      roomId: body.roomId,
      checkIn: new Date(body.checkIn),
      checkOut: new Date(body.checkOut),
      totalAmount: body.totalAmount,
      paidAmount: body.paidAmount,
      status: body.status,
      adultCount: body.adultCount,
      childCount: body.childCount,
      packageId: body.packageId,
      mealsPerGuestPerNightOverride: body.mealsPerGuestPerNightOverride,
    });
  }

  @Patch("reservations/:id")
  @RequirePermission(Permission.PMS_WRITE)
  updateReservation(
    @Param("id") id: string,
    @Query("branchId") branchId: string,
    @Tenant() t: TenantContext,
    @Body()
    body: {
      guestId?: string;
      roomId?: string;
      checkIn?: string;
      checkOut?: string;
      totalAmount?: number;
      paidAmount?: number;
      adultCount?: number;
      childCount?: number;
      packageId?: string | null;
      mealsPerGuestPerNightOverride?: number | null;
    },
  ) {
    return this.pms.updateReservation(this.branchId(t, branchId), id, {
      ...body,
      checkIn: body.checkIn ? new Date(body.checkIn) : undefined,
      checkOut: body.checkOut ? new Date(body.checkOut) : undefined,
    });
  }

  @Patch("reservations/:id/confirm")
  @RequirePermission(Permission.PMS_WRITE)
  confirmReservation(
    @Param("id") id: string,
    @Query("branchId") branchId: string,
    @Tenant() t: TenantContext,
  ) {
    return this.pms.confirmReservation(this.branchId(t, branchId), id, t.userId);
  }

  @Patch("reservations/:id/payment")
  @RequirePermission(Permission.PMS_WRITE)
  recordPayment(
    @Param("id") id: string,
    @Query("branchId") branchId: string,
    @Tenant() t: TenantContext,
    @Body() body: { paidAmount: number },
  ) {
    return this.pms.recordPayment(this.branchId(t, branchId), id, body.paidAmount);
  }

  @Get("availability")
  @RequirePermission(Permission.PMS_READ)
  getAvailability(
    @Query("branchId") branchId: string,
    @Query("checkIn") checkIn: string,
    @Query("checkOut") checkOut: string,
    @Query("roomTypeId") roomTypeId: string | undefined,
    @Query("excludeReservationId") excludeReservationId: string | undefined,
    @Tenant() t: TenantContext,
  ) {
    return this.availability.findAvailableRooms({
      branchId: this.branchId(t, branchId),
      checkIn: new Date(checkIn),
      checkOut: new Date(checkOut),
      roomTypeId,
      excludeReservationId,
    });
  }

  @Patch("reservations/:id/check-in")
  @RequirePermission(Permission.PMS_WRITE)
  checkIn(
    @Param("id") id: string,
    @Query("branchId") branchId: string,
    @Tenant() t: TenantContext,
  ) {
    return this.pms.checkIn(id, this.branchId(t, branchId), t.userId);
  }

  @Patch("reservations/:id/check-out")
  @RequirePermission(Permission.PMS_WRITE)
  checkOut(
    @Param("id") id: string,
    @Query("branchId") branchId: string,
    @Tenant() t: TenantContext,
  ) {
    return this.pms.checkOut(id, this.branchId(t, branchId), t.userId);
  }

  @Patch("reservations/:id/cancel")
  @RequirePermission(Permission.PMS_WRITE)
  cancel(
    @Param("id") id: string,
    @Query("branchId") branchId: string,
    @Tenant() t: TenantContext,
  ) {
    return this.pms.cancelReservation(id, this.branchId(t, branchId), t.userId);
  }

  @Delete("reservations/:id")
  @RequirePermission(Permission.PMS_WRITE)
  deleteReservation(
    @Param("id") id: string,
    @Query("branchId") branchId: string,
    @Tenant() t: TenantContext,
  ) {
    return this.pms.deleteReservation(this.branchId(t, branchId), id, t.userId);
  }

  @Get("rate-plans")
  @RequirePermission(Permission.PMS_READ)
  listRatePlans(@Tenant() t: TenantContext) {
    return this.ratePlans.list(t.organizationId);
  }

  @Post("rate-plans")
  @RequirePermission(Permission.PMS_WRITE)
  createRatePlan(
    @Tenant() t: TenantContext,
    @Body()
    body: {
      roomTypeId: string;
      name: string;
      validFrom: string;
      validTo: string;
      baseModifier?: number;
      isActive?: boolean;
    },
  ) {
    return this.ratePlans.create(t.organizationId, body);
  }

  @Patch("rate-plans/:id")
  @RequirePermission(Permission.PMS_WRITE)
  updateRatePlan(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      validFrom?: string;
      validTo?: string;
      baseModifier?: number;
      isActive?: boolean;
    },
  ) {
    return this.ratePlans.update(t.organizationId, id, body);
  }

  @Delete("rate-plans/:id")
  @RequirePermission(Permission.PMS_WRITE)
  deleteRatePlan(@Tenant() t: TenantContext, @Param("id") id: string) {
    return this.ratePlans.delete(t.organizationId, id);
  }

  @Post("rate-plans/:id/rules")
  @RequirePermission(Permission.PMS_WRITE)
  addRateRule(
    @Tenant() t: TenantContext,
    @Param("id") id: string,
    @Body()
    body: {
      dayOfWeek?: number | null;
      minStayNights?: number | null;
      pricePerNight?: number | null;
    },
  ) {
    return this.ratePlans.addRule(t.organizationId, id, body);
  }

  @Delete("rate-plans/:planId/rules/:ruleId")
  @RequirePermission(Permission.PMS_WRITE)
  deleteRateRule(
    @Tenant() t: TenantContext,
    @Param("planId") planId: string,
    @Param("ruleId") ruleId: string,
  ) {
    return this.ratePlans.deleteRule(t.organizationId, planId, ruleId);
  }

  @Get("pricing/quote")
  @RequirePermission(Permission.PMS_READ)
  quote(
    @Query("roomId") roomId: string,
    @Query("checkIn") checkIn: string,
    @Query("checkOut") checkOut: string,
  ) {
    return this.pricing.quoteStay(roomId, new Date(checkIn), new Date(checkOut));
  }
}
