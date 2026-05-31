import type { EmployeeStatus } from "./enums";

export interface CreateEmployeeDto {
  name: string;
  designation: string;
  salary: number;
  userId?: string;
  branchId?: string;
}

export interface UpdateEmployeeDto {
  name?: string;
  designation?: string;
  salary?: number;
  branchId?: string | null;
  status?: EmployeeStatus;
}

export interface ClockAttendanceDto {
  type: "CLOCK_IN" | "CLOCK_OUT";
}

export interface RequestPayrollRunDto {
  periodStart: string;
  periodEnd: string;
}

export interface StaffMealRecipeLineDto {
  inventoryItemId: string;
  quantity: number;
}

export interface UpsertStaffMealRecipeDto {
  name: string;
  lines: StaffMealRecipeLineDto[];
}

export interface StaffMealDto {
  employeeId: string;
  staffMealRecipeId: string;
  mealCount: number;
  deductFromPayroll?: boolean;
}
