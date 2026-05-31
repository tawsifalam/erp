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
  async sync(@CurrentUser() user: AuthUserPayload) {
    return this.authService.syncUser(user);
  }

  @Post("me")
  @UseGuards(PropelAuthGuard)
  me(@CurrentUser() user: AuthUserPayload) {
    return user;
  }
}
