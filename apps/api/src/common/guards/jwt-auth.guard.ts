import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { TokenService } from "../../auth/token.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Invalid or missing access token");
    }
    const token = header.slice("Bearer ".length);
    try {
      request.user = await this.tokens.verifyAccessToken(token);
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or missing access token");
    }
  }
}
