import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { BullModule } from "@nestjs/bullmq";
import { parseApiEnv } from "@erp/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { TenantsModule } from "./tenants/tenants.module";
import { UsersModule } from "./users/users.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { PmsModule } from "./pms/pms.module";
import { PosModule } from "./pos/pos.module";
import { InventoryModule } from "./inventory/inventory.module";
import { AccountingModule } from "./accounting/accounting.module";
import { HrModule } from "./hr/hr.module";
import { PayrollModule } from "./payroll/payroll.module";
import { ReportingModule } from "./reporting/reporting.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { StorageModule } from "./storage/storage.module";
import { EventsModule } from "./common/events/events.module";
import { InclusionsModule } from "./inclusions/inclusions.module";
import { HealthController } from "./health.controller";

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load root .env first, then app-level override — only root file needed in practice
      envFilePath: ["../../.env", ".env"],
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      connection: { url: parseApiEnv().REDIS_URL },
    }),
    BullModule.registerQueue(
      { name: "payroll" },
      { name: "reports" },
      { name: "notifications" },
      { name: "pdf" },
    ),
    PrismaModule,
    StorageModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    PermissionsModule,
    PmsModule,
    PosModule,
    InventoryModule,
    AccountingModule,
    HrModule,
    PayrollModule,
    ReportingModule,
    NotificationsModule,
    IntegrationsModule,
    RealtimeModule,
    EventsModule,
    InclusionsModule,
  ],
})
export class AppModule {}
