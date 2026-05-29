import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PayrollProcessor } from "./payroll.processor";
import { PayrollListener } from "./payroll.listener";
import { PayrollController } from "./payroll.controller";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [BullModule.registerQueue({ name: "payroll" }), StorageModule],
  controllers: [PayrollController],
  providers: [PayrollProcessor, PayrollListener],
})
export class PayrollModule {}
