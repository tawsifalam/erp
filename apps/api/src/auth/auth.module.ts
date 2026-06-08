import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthCoreModule } from "./auth-core.module";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantsModule } from "../tenants/tenants.module";

@Global()
@Module({
  imports: [AuthCoreModule, TenantsModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, AuthCoreModule],
})
export class AuthModule {}
