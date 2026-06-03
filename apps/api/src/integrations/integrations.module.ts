import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PmsModule } from "../pms/pms.module";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsWebhookController } from "./integrations-webhook.controller";
import { IntegrationsService } from "./integrations.service";

@Module({
  imports: [AuditModule, PmsModule],
  controllers: [IntegrationsController, IntegrationsWebhookController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
