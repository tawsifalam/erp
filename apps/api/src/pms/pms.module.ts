import { Module } from "@nestjs/common";
import { PmsController } from "./pms.controller";
import { PmsService } from "./pms.service";
import { AvailabilityService } from "./availability.service";
import { RatePricingService } from "./rate-pricing.service";
import { RatePlansService } from "./rate-plans.service";
import { RealtimeModule } from "../realtime/realtime.module";
import { InclusionsModule } from "../inclusions/inclusions.module";

@Module({
  imports: [RealtimeModule, InclusionsModule],
  controllers: [PmsController],
  providers: [PmsService, AvailabilityService, RatePricingService, RatePlansService],
  exports: [PmsService, RatePricingService],
})
export class PmsModule {}
