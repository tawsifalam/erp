import { Module } from "@nestjs/common";
import { PmsController } from "./pms.controller";
import { PmsService } from "./pms.service";
import { AvailabilityService } from "./availability.service";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [RealtimeModule],
  controllers: [PmsController],
  providers: [PmsService, AvailabilityService],
  exports: [PmsService],
})
export class PmsModule {}
