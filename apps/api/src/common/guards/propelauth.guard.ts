import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PropelAuthService } from "../../auth/propelauth.service";

@Injectable()
export class PropelAuthGuard implements CanActivate {
  constructor(private readonly propelAuth: PropelAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    try {
      request.user = await this.propelAuth.validateAuthorizationHeader(
        request.headers.authorization,
      );
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or missing access token");
    }
  }
}
