import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ReservationStatus } from "@erp/types";
import { generatePrefixedId, rangesOverlap } from "@erp/utils";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { isChannelAdapter } from "./channel-manager.constants";

const BLOCKING_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.INQUIRY,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

export type ChannelInventoryDay = {
  date: string;
  totalRooms: number;
  availableCount: number;
  blockedCount: number;
};

export type ChannelAvailabilityExport = {
  connectionId: string;
  branchId: string;
  from: string;
  to: string;
  exportedAt: string;
  roomTypes: {
    roomTypeId: string;
    roomTypeName: string;
    inventory: ChannelInventoryDay[];
  }[];
};

export type ChannelAvailabilityBlockView = {
  id: string;
  branchId: string;
  connectionId: string | null;
  roomId: string | null;
  roomTypeId: string | null;
  startDate: string;
  endDate: string;
  reason: string | null;
  createdAt: Date;
};

@Injectable()
export class ChannelManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async exportAvailability(
    organizationId: string,
    connectionId: string,
    fromRaw: string,
    toRaw: string,
  ): Promise<ChannelAvailabilityExport> {
    const connection = await this.requireChannelConnection(organizationId, connectionId);
    const branchId = connection.branchId!;
    const from = this.parseDate(fromRaw, "from");
    const to = this.parseDate(toRaw, "to");
    if (to <= from) {
      throw new BadRequestException("to must be after from");
    }
    const maxDays = 366;
    const nights = this.eachNight(from, to);
    if (nights.length > maxDays) {
      throw new BadRequestException(`Date range cannot exceed ${maxDays} nights`);
    }

    const rooms = await this.prisma.room.findMany({
      where: { branchId, status: { not: "MAINTENANCE" } },
      include: { roomType: true },
    });

    const rangeEnd = this.addDays(to, -1);
    const reservations = await this.prisma.reservation.findMany({
      where: {
        branchId,
        status: { in: BLOCKING_RESERVATION_STATUSES },
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
    });

    const blocks = await this.prisma.channelAvailabilityBlock.findMany({
      where: {
        branchId,
        OR: [{ connectionId: null }, { connectionId }],
        startDate: { lte: rangeEnd },
        endDate: { gte: from },
      },
    });

    const roomTypesMap = new Map<
      string,
      { roomTypeId: string; roomTypeName: string; roomIds: string[] }
    >();
    for (const room of rooms) {
      const entry = roomTypesMap.get(room.roomTypeId) ?? {
        roomTypeId: room.roomTypeId,
        roomTypeName: room.roomType.name,
        roomIds: [],
      };
      entry.roomIds.push(room.id);
      roomTypesMap.set(room.roomTypeId, entry);
    }

    const roomTypes = [...roomTypesMap.values()].map((rt) => {
      const inventory: ChannelInventoryDay[] = nights.map((date) => {
        const nightStart = this.parseDate(date, "date");
        const nightEnd = this.addDays(nightStart, 1);
        let availableCount = 0;
        for (const roomId of rt.roomIds) {
          const reserved = reservations.some(
            (r) =>
              r.roomId === roomId &&
              rangesOverlap(nightStart, nightEnd, r.checkIn, r.checkOut),
          );
          const blocked = blocks.some((b) => {
            if (b.roomId) {
              return (
                b.roomId === roomId &&
                this.datesOverlap(nightStart, nightEnd, b.startDate, b.endDate)
              );
            }
            if (b.roomTypeId) {
              return (
                b.roomTypeId === rt.roomTypeId &&
                this.datesOverlap(nightStart, nightEnd, b.startDate, b.endDate)
              );
            }
            return this.datesOverlap(nightStart, nightEnd, b.startDate, b.endDate);
          });
          if (!reserved && !blocked) availableCount += 1;
        }
        const totalRooms = rt.roomIds.length;
        return {
          date,
          totalRooms,
          availableCount,
          blockedCount: totalRooms - availableCount,
        };
      });
      return {
        roomTypeId: rt.roomTypeId,
        roomTypeName: rt.roomTypeName,
        inventory,
      };
    });

    return {
      connectionId,
      branchId,
      from: fromRaw,
      to: toRaw,
      exportedAt: new Date().toISOString(),
      roomTypes,
    };
  }

  async listBlocks(
    organizationId: string,
    connectionId: string,
  ): Promise<ChannelAvailabilityBlockView[]> {
    const connection = await this.requireChannelConnection(organizationId, connectionId);
    const rows = await this.prisma.channelAvailabilityBlock.findMany({
      where: {
        branchId: connection.branchId!,
        OR: [{ connectionId: null }, { connectionId }],
      },
      orderBy: { startDate: "desc" },
      take: 100,
    });
    return rows.map((r) => this.toBlockView(r));
  }

  async createBlock(
    organizationId: string,
    connectionId: string,
    userId: string,
    body: {
      roomId?: string | null;
      roomTypeId?: string | null;
      startDate: string;
      endDate: string;
      reason?: string;
    },
  ): Promise<ChannelAvailabilityBlockView> {
    const connection = await this.requireChannelConnection(organizationId, connectionId);
    const branchId = connection.branchId!;
    const startDate = this.parseDate(body.startDate, "startDate");
    const endDate = this.parseDate(body.endDate, "endDate");
    if (endDate < startDate) {
      throw new BadRequestException("endDate must be on or after startDate");
    }

    if (body.roomId) {
      const room = await this.prisma.room.findFirst({
        where: { id: body.roomId, branchId },
      });
      if (!room) throw new BadRequestException("roomId not found on connection branch");
    }
    if (body.roomTypeId) {
      const rt = await this.prisma.roomType.findFirst({
        where: { id: body.roomTypeId, organizationId },
      });
      if (!rt) throw new BadRequestException("roomTypeId not found in organization");
    }

    const created = await this.prisma.channelAvailabilityBlock.create({
      data: {
        id: generatePrefixedId("cab"),
        organizationId,
        branchId,
        connectionId,
        roomId: body.roomId ?? null,
        roomTypeId: body.roomTypeId ?? null,
        startDate,
        endDate,
        reason: body.reason?.trim() || null,
      },
    });

    await this.audit.record({
      organizationId,
      userId,
      action: "channel.block.create",
      entityType: "channel_availability_block",
      entityId: created.id,
      metadata: { connectionId, startDate: body.startDate, endDate: body.endDate },
    });

    return this.toBlockView(created);
  }

  async deleteBlock(organizationId: string, connectionId: string, userId: string, blockId: string) {
    const connection = await this.requireChannelConnection(organizationId, connectionId);
    const row = await this.prisma.channelAvailabilityBlock.findFirst({
      where: {
        id: blockId,
        organizationId,
        branchId: connection.branchId!,
        OR: [{ connectionId: null }, { connectionId }],
      },
    });
    if (!row) throw new NotFoundException("Availability block not found");
    await this.prisma.channelAvailabilityBlock.delete({ where: { id: blockId } });
    await this.audit.record({
      organizationId,
      userId,
      action: "channel.block.delete",
      entityType: "channel_availability_block",
      entityId: blockId,
    });
    return { ok: true };
  }

  private async requireChannelConnection(organizationId: string, connectionId: string) {
    const connection = await this.prisma.integrationConnection.findFirst({
      where: { id: connectionId, organizationId },
    });
    if (!connection) throw new NotFoundException("Integration connection not found");
    if (!isChannelAdapter(connection.adapterKey)) {
      throw new BadRequestException("Connection adapter does not support channel manager");
    }
    if (!connection.branchId) {
      throw new BadRequestException("Channel manager requires a branch on the connection");
    }
    return connection;
  }

  private toBlockView(row: {
    id: string;
    branchId: string;
    connectionId: string | null;
    roomId: string | null;
    roomTypeId: string | null;
    startDate: Date;
    endDate: Date;
    reason: string | null;
    createdAt: Date;
  }): ChannelAvailabilityBlockView {
    return {
      id: row.id,
      branchId: row.branchId,
      connectionId: row.connectionId,
      roomId: row.roomId,
      roomTypeId: row.roomTypeId,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      reason: row.reason,
      createdAt: row.createdAt,
    };
  }

  private parseDate(value: string, field: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new BadRequestException(`${field} must be YYYY-MM-DD`);
    const d = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid ${field}`);
    return d;
  }

  private eachNight(from: Date, to: Date): string[] {
    const nights: string[] = [];
    const cur = new Date(from);
    while (cur < to) {
      nights.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return nights;
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  private datesOverlap(
    nightStart: Date,
    nightEnd: Date,
    blockStart: Date,
    blockEnd: Date,
  ): boolean {
    const blockNightEnd = this.addDays(blockEnd, 1);
    return rangesOverlap(nightStart, nightEnd, blockStart, blockNightEnd);
  }
}
