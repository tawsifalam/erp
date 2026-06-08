import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../notifications/email.service";

@Injectable()
export class EmailAuthService {
  constructor(
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  private appUrl(): string {
    return (
      this.config.get<string>("APP_URL") ??
      this.config.get<string>("CORS_ORIGIN") ??
      "http://localhost:3000"
    ).replace(/\/$/, "");
  }

  async sendInviteEmail(input: {
    to: string;
    organizationName: string;
    inviteToken: string;
  }): Promise<void> {
    const link = `${this.appUrl()}/auth/accept-invite?token=${encodeURIComponent(input.inviteToken)}`;
    await this.email.send({
      to: input.to,
      subject: `You're invited to ${input.organizationName} on One Venue`,
      body: `You have been invited to join ${input.organizationName}.\n\nAccept your invite and set your password:\n${link}\n\nThis link expires in 7 days.`,
    });
  }

  async sendPasswordResetEmail(input: { to: string; resetToken: string }): Promise<void> {
    const link = `${this.appUrl()}/auth/reset-password?token=${encodeURIComponent(input.resetToken)}`;
    await this.email.send({
      to: input.to,
      subject: "Reset your One Venue password",
      body: `Reset your password using this link (valid for 1 hour):\n${link}\n\nIf you did not request this, you can ignore this email.`,
    });
  }
}
