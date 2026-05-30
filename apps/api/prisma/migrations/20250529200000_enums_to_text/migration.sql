-- Convert PostgreSQL enum columns to TEXT (values unchanged as string literals)

ALTER TABLE "UserOrganization" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "UserOrganization" ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;

ALTER TABLE "Room" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Room" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "Room" ALTER COLUMN "status" SET DEFAULT 'VACANT';

ALTER TABLE "Reservation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Reservation" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "Reservation" ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';

ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "Order" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" TYPE TEXT USING "paymentStatus"::TEXT;
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID';

ALTER TABLE "KitchenTicket" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "KitchenTicket" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "KitchenTicket" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

ALTER TABLE "InventoryMovement" ALTER COLUMN "direction" TYPE TEXT USING "direction"::TEXT;
ALTER TABLE "InventoryMovement" ALTER COLUMN "movementType" TYPE TEXT USING "movementType"::TEXT;

ALTER TABLE "Account" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;

ALTER TABLE "AttendanceRecord" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;

ALTER TABLE "PayrollRun" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PayrollRun" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "PayrollRun" ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "Role";
DROP TYPE "RoomStatus";
DROP TYPE "ReservationStatus";
DROP TYPE "OrderStatus";
DROP TYPE "PaymentStatus";
DROP TYPE "MovementType";
DROP TYPE "MovementDirection";
DROP TYPE "AccountType";
DROP TYPE "PayrollRunStatus";
DROP TYPE "AttendanceType";
