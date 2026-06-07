import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TenantContext } from "@erp/types";
import { PrismaService } from "../../prisma/prisma.service";
import {
  hasImplicitBranchAccess,
  UserBranchStatus,
} from "../../tenants/branch-access.constants";

@Injectable()
export class TenantScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve and validate a branch id for tenant-scoped routes.
   * Prefers override (query/body) over X-Branch-Id header.
   */
  async resolveBranchId(
    tenant: TenantContext,
    override?: string | null,
    options?: { required?: boolean },
  ): Promise<string | undefined> {
    const required = options?.required ?? true;
    const branchId = override ?? tenant.branchId ?? undefined;

    if (!branchId) {
      if (required) {
        throw new BadRequestException("branchId is required");
      }
      return undefined;
    }

    await this.assertBranchAccess(tenant, branchId);
    return branchId;
  }

  async assertBranchInOrganization(
    organizationId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
    if (!branch) {
      throw new ForbiddenException("Branch does not belong to this organization");
    }
  }

  async organizationIdForBranch(branchId: string): Promise<string> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { organizationId: true },
    });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch.organizationId;
  }

  async assertGuestInOrganization(
    organizationId: string,
    guestId: string,
  ): Promise<void> {
    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, organizationId },
    });
    if (!guest) throw new NotFoundException("Guest not found");
  }

  async assertRoomTypeInOrganization(
    organizationId: string,
    roomTypeId: string,
  ): Promise<void> {
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, organizationId },
    });
    if (!roomType) throw new NotFoundException("Room type not found");
  }

  async assertRoomInBranch(branchId: string, roomId: string): Promise<void> {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, branchId },
    });
    if (!room) throw new NotFoundException("Room not found");
  }

  async assertRoomInOrganization(
    organizationId: string,
    roomId: string,
  ): Promise<void> {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, branch: { organizationId } },
    });
    if (!room) throw new NotFoundException("Room not found");
  }

  async assertAccountInOrganization(
    organizationId: string,
    accountId: string,
  ): Promise<void> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId },
    });
    if (!account) throw new NotFoundException("Account not found");
  }

  async assertAccountsInOrganization(
    organizationId: string,
    accountIds: string[],
  ): Promise<void> {
    const uniqueIds = [...new Set(accountIds)];
    for (const accountId of uniqueIds) {
      await this.assertAccountInOrganization(organizationId, accountId);
    }
  }

  async assertMenuItemInBranch(
    organizationId: string,
    branchId: string,
    menuItemId: string,
  ): Promise<void> {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: { category: true },
    });
    if (!item) throw new NotFoundException("Menu item not found");
    if (
      item.category.organizationId !== organizationId ||
      item.category.branchId !== branchId
    ) {
      throw new NotFoundException("Menu item not found");
    }
  }

  async assertEmployeeInOrganization(
    organizationId: string,
    employeeId: string,
  ): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
    });
    if (!employee) throw new NotFoundException("Employee not found");
  }

  async assertReservationInBranch(
    branchId: string,
    reservationId: string,
  ): Promise<void> {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, branchId },
    });
    if (!reservation) throw new NotFoundException("Reservation not found");
  }

  async assertOrderInBranch(branchId: string, orderId: string): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId },
    });
    if (!order) throw new NotFoundException("Order not found");
  }

  private async assertBranchAccess(
    tenant: TenantContext,
    branchId: string,
  ): Promise<void> {
    await this.assertBranchInOrganization(tenant.organizationId, branchId);

    if (!hasImplicitBranchAccess(tenant.role)) {
      const grant = await this.prisma.userBranch.findUnique({
        where: { userId_branchId: { userId: tenant.userId, branchId } },
      });
      if (
        !grant ||
        grant.organizationId !== tenant.organizationId ||
        grant.status !== UserBranchStatus.ACTIVE
      ) {
        throw new ForbiddenException("You do not have access to this branch");
      }
    }
  }
}
