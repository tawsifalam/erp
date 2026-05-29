import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PropelAuthService } from "./propelauth.service";
import { PropelAuthGuard } from "../common/guards/propelauth.guard";

@Global()
@Module({
  controllers: [AuthController],
  providers: [PropelAuthService, PropelAuthGuard, AuthService],
  exports: [PropelAuthService, PropelAuthGuard, AuthService],
})
export class AuthModule {}
