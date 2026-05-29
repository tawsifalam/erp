import { Injectable } from "@nestjs/common";
import { AttendanceType, MovementType } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { PayrollRunRequestedEvent } from "../common/events/payroll-run-requested.event";

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly events: EventEmitter2,
  ) {}

  listEmployees(organizationId: string) {
    return this.prisma.employee.findMany({
      where: { organizationId },
      include: { branch: true, user: true },
    });
  }

  createEmployee(
    organizationId: string,
    data: {
      name: string;
      designation: string;
      salary: number;
      userId?: string;
      branchId?: string;
    },
  ) {
    return this.prisma.employee.create({
      data: { organizationId, ...data },
    });
  }

  clockAttendance(employeeId: string, branchId: string, type: AttendanceType) {
    return this.prisma.attendanceRecord.create({
      data: { employeeId, branchId, type },
    });
  }

  async recordStaffMeal(params: {
    employeeId: string;
    branchId: string;
    inventoryItemId: string;
    quantity: number;
    deductFromPayroll?: boolean;
  }) {
    await this.inventory.createMovement({
      itemId: params.inventoryItemId,
      branchId: params.branchId,
      movementType: MovementType.STAFF_MEAL,
      quantity: params.quantity,
      referenceType: "StaffMeal",
      referenceId: params.employeeId,
    });

    return this.prisma.staffMeal.create({
      data: {
        employeeId: params.employeeId,
        inventoryItemId: params.inventoryItemId,
        quantity: params.quantity,
        deductFromPayroll: params.deductFromPayroll ?? false,
      },
    });
  }

  async requestPayrollRun(organizationId: string, periodStart: Date, periodEnd: Date) {
    const run = await this.prisma.payrollRun.create({
      data: { organizationId, periodStart, periodEnd },
    });
    this.events.emit("payroll.run_requested", new PayrollRunRequestedEvent(run.id));
    return run;
  }
}
