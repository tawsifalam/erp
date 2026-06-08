import { Global, Module } from "@nestjs/common";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { SessionService } from "./session.service";
import { EmailAuthService } from "./email-auth.service";

@Global()
@Module({
  providers: [PasswordService, TokenService, SessionService, EmailAuthService],
  exports: [PasswordService, TokenService, SessionService, EmailAuthService],
})
export class AuthCoreModule {}
