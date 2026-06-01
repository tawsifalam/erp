import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "./email.service";

type EmailJobData = {
  userId: string;
  title: string;
  body: string;
};

@Processor("notifications")
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>) {
    if (job.name === "email") {
      const user = await this.prisma.user.findUnique({
        where: { id: job.data.userId },
        select: { email: true },
      });
      if (!user?.email) {
        this.logger.warn(`No email for user ${job.data.userId}; skipping send`);
        return;
      }
      try {
        await this.email.send({
          to: user.email,
          subject: job.data.title,
          body: job.data.body,
        });
      } catch (err) {
        this.logger.error(
          `Email delivery failed for user ${job.data.userId}: ${err instanceof Error ? err.message : err}`,
        );
      }
      return;
    }
    this.logger.warn(`Unknown notification job: ${job.name}`);
  }
}
