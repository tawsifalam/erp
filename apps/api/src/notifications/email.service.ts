import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: SendEmailInput): Promise<void> {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    const from = this.config.get<string>("EMAIL_FROM", "ERP <onboarding@resend.dev>");

    if (!apiKey) {
      this.logger.log(`[email] to=${input.to} subject="${input.subject}" — ${input.body}`);
      return;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.body,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      this.logger.error(`Resend API failed (${res.status}): ${detail}`);
      throw new Error(`Failed to send email (${res.status})`);
    }
  }
}
