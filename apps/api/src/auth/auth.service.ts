import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JoinRequestStatus } from "@erp/types";
import type { AuthUserPayload } from "@erp/types";
import { PrismaService } from "../prisma/prisma.service";
import { TenantsService } from "../tenants/tenants.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { SessionService } from "./session.service";
import { EmailAuthService } from "./email-auth.service";
import type {
  AcceptInviteDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto/auth.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly emailAuth: EmailAuthService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private splitName(name?: string | null): { firstName?: string; lastName?: string } {
    if (!name?.trim()) return {};
    const parts = name.trim().split(/\s+/);
    return {
      firstName: parts[0],
      lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
    };
  }

  private async issueSession(
    user: { id: string; email: string; name: string | null },
    meta?: { userAgent?: string; ip?: string },
  ) {
    const { firstName, lastName } = this.splitName(user.name);
    const accessToken = await this.tokens.signAccessToken({
      userId: user.id,
      email: user.email,
      firstName,
      lastName,
    });
    const refreshToken = this.sessions.createRefreshToken();
    await this.sessions.storeRefreshToken(refreshToken, user.id, meta);
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async register(dto: RegisterDto, meta?: { userAgent?: string; ip?: string }) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("An account with this email already exists");

    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name?.trim() || null,
        emailVerifiedAt: new Date(),
      },
    });

    return this.issueSession(user, meta);
  }

  async login(dto: LoginDto, meta?: { userAgent?: string; ip?: string }) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const valid = await this.passwords.verify(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid email or password");
    return this.issueSession(user, meta);
  }

  async refresh(refreshToken: string, meta?: { userAgent?: string; ip?: string }) {
    const session = await this.sessions.validateRefreshToken(refreshToken);
    if (!session) throw new UnauthorizedException("Invalid or expired session");

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) throw new UnauthorizedException("Invalid or expired session");

    const newRefresh = this.sessions.createRefreshToken();
    await this.sessions.rotateRefreshToken(refreshToken, newRefresh, user.id, meta);

    const { firstName, lastName } = this.splitName(user.name);
    const accessToken = await this.tokens.signAccessToken({
      userId: user.id,
      email: user.email,
      firstName,
      lastName,
    });

    return {
      accessToken,
      refreshToken: newRefresh,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) await this.sessions.revokeRefreshToken(refreshToken);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { ok: true };
    const token = await this.tokens.signPasswordResetToken(user.id, email);
    await this.emailAuth.sendPasswordResetEmail({ to: email, resetToken: token });
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    let claims: { userId: string; email: string };
    try {
      claims = await this.tokens.verifyPasswordResetToken(dto.token);
    } catch {
      throw new BadRequestException("Invalid or expired reset link");
    }
    const passwordHash = await this.passwords.hash(dto.password);
    await this.prisma.user.update({
      where: { id: claims.userId },
      data: { passwordHash, emailVerifiedAt: new Date() },
    });
    await this.sessions.revokeAllForUser(claims.userId);
    return { ok: true };
  }

  async getInvitePreview(token: string) {
    let claims: { inviteId: string; organizationId: string; email: string };
    try {
      claims = await this.tokens.verifyInviteToken(token);
    } catch {
      throw new BadRequestException("Invalid or expired invite link");
    }
    const invite = await this.prisma.organizationInvite.findFirst({
      where: { id: claims.inviteId, status: "PENDING" },
      include: { organization: { select: { id: true, name: true } } },
    });
    if (!invite) throw new BadRequestException("Invite is no longer valid");
    return {
      email: invite.email,
      organizationName: invite.organization.name,
      organizationId: invite.organization.id,
    };
  }

  async acceptInvite(dto: AcceptInviteDto, meta?: { userAgent?: string; ip?: string }) {
    let claims: { inviteId: string; organizationId: string; email: string };
    try {
      claims = await this.tokens.verifyInviteToken(dto.token);
    } catch {
      throw new BadRequestException("Invalid or expired invite link");
    }

    const invite = await this.prisma.organizationInvite.findFirst({
      where: {
        id: claims.inviteId,
        organizationId: claims.organizationId,
        email: claims.email,
        status: "PENDING",
      },
    });
    if (!invite) throw new BadRequestException("Invite is no longer valid");

    const passwordHash = await this.passwords.hash(dto.password);
    let user = await this.prisma.user.findUnique({ where: { email: claims.email } });
    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: user.passwordHash ?? passwordHash,
          name: dto.name?.trim() || user.name,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: claims.email,
          passwordHash,
          name: dto.name?.trim() || null,
          emailVerifiedAt: new Date(),
        },
      });
    }

    await this.tenants.fulfillPendingInvitesForUser(user.id, claims.email);
    return this.issueSession(user, meta);
  }

  async syncUser(claims: AuthUserPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: claims.userId },
    });
    if (!user) throw new UnauthorizedException("User not found");

    await this.tenants.fulfillPendingInvitesForUser(user.id, user.email);

    const membershipCount = await this.prisma.userOrganization.count({
      where: { userId: user.id },
    });

    const pendingJoinRequest = await this.prisma.organizationJoinRequest.findFirst({
      where: { userId: user.id, status: JoinRequestStatus.PENDING },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { memberships: { include: { organization: true } } },
    });

    return {
      user: fullUser,
      hasActiveMembership: membershipCount > 0,
      pendingJoinRequest: pendingJoinRequest
        ? {
            id: pendingJoinRequest.id,
            organizationId: pendingJoinRequest.organizationId,
            organizationName: pendingJoinRequest.organization.name,
            message: pendingJoinRequest.message,
            createdAt: pendingJoinRequest.createdAt,
          }
        : null,
    };
  }

  async createInviteToken(inviteId: string, organizationId: string, email: string) {
    return this.tokens.signInviteToken({ inviteId, organizationId, email });
  }

  async sendInviteEmail(organizationName: string, email: string, inviteToken: string) {
    await this.emailAuth.sendInviteEmail({ to: email, organizationName, inviteToken });
  }
}
