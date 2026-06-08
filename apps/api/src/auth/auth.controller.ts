import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUserPayload } from "@erp/types";
import { AuthService } from "./auth.service";
import {
  AcceptInviteDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto/auth.dto";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "./auth-cookie.util";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private requestMeta(req: Request) {
    return {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    };
  }

  @Post("register")
  async register(
    @Body() body: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(body, this.requestMeta(req));
    setRefreshCookie(res, this.config, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post("login")
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body, this.requestMeta(req));
    setRefreshCookie(res, this.config, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = readRefreshCookie(req.cookies ?? {}, this.config);
    if (!token) {
      clearRefreshCookie(res, this.config);
      return { accessToken: null };
    }
    try {
      const result = await this.authService.refresh(token, this.requestMeta(req));
      setRefreshCookie(res, this.config, result.refreshToken);
      return { accessToken: result.accessToken, user: result.user };
    } catch {
      clearRefreshCookie(res, this.config);
      return { accessToken: null };
    }
  }

  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = readRefreshCookie(req.cookies ?? {}, this.config);
    await this.authService.logout(token);
    clearRefreshCookie(res, this.config);
    return { ok: true };
  }

  @Post("forgot-password")
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body);
  }

  @Post("reset-password")
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @Get("invite/:token")
  getInvite(@Param("token") token: string) {
    return this.authService.getInvitePreview(token);
  }

  @Post("accept-invite")
  async acceptInvite(
    @Body() body: AcceptInviteDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.acceptInvite(body, this.requestMeta(req));
    setRefreshCookie(res, this.config, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post("sync")
  @UseGuards(JwtAuthGuard)
  async sync(@CurrentUser() user: AuthUserPayload) {
    return this.authService.syncUser(user);
  }

  @Post("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUserPayload) {
    return user;
  }
}
