import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { PropelAuthGuard } from "../common/guards/propelauth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUserPayload } from "@erp/types";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("sync")
  @UseGuards(PropelAuthGuard)
  async sync(
    @CurrentUser() user: AuthUserPayload,
    @Body() body?: { orgId?: string },
  ) {
    return this.authService.syncUser(user, body?.orgId ?? user.orgId);
  }

  @Post("me")
  @UseGuards(PropelAuthGuard)
  me(@CurrentUser() user: AuthUserPayload) {
    return user;
  }
}
