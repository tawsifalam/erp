export interface CreateEmployeeDto {
    name: string;
    designation: string;
    salary: number;
    userId?: string;
    branchId?: string;
}
export interface ClockAttendanceDto {
    type: "CLOCK_IN" | "CLOCK_OUT";
}
export interface RequestPayrollRunDto {
    periodStart: string;
    periodEnd: string;
}
export interface StaffMealDto {
    inventoryItemId: string;
    quantity: number;
    employeeId: string;
    deductFromPayroll?: boolean;
}
