import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PayrollRunRequestedEvent } from "../common/events/payroll-run-requested.event";

@Injectable()
export class PayrollListener {
  constructor(@InjectQueue("payroll") private readonly payrollQueue: Queue) {}

  @OnEvent("payroll.run_requested")
  async handle(event: PayrollRunRequestedEvent) {
    await this.payrollQueue.add("process", { payrollRunId: event.payrollRunId });
  }
}
