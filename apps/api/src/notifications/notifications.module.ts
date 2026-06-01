import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { NotificationsProcessor } from "./notifications.processor";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: "notifications" })],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
