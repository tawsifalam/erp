import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";

type EmailJobData = {
  userId: string;
  title: string;
  body: string;
};

@Processor("notifications")
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(job: Job<EmailJobData>) {
    if (job.name === "email") {
      this.logger.log(
        `Email notification to user ${job.data.userId}: ${job.data.title} — ${job.data.body}`,
      );
      return;
    }
    this.logger.warn(`Unknown notification job: ${job.name}`);
  }
}
