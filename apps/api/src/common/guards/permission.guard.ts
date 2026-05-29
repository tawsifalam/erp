import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Permission, Role } from "@erp/types";
import { roleHasPermission } from "@erp/utils";
import { PERMISSION_KEY } from "../decorators/require-permission.decorator";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const role = request.tenant?.role as Role | undefined;
    if (!role || !roleHasPermission(role, required)) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
    return true;
  }
}
