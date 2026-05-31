import { Permission, Role } from "@erp/types";
export declare function roleHasPermission(role: Role, permission: Permission): boolean;
export declare function getDefaultRouteForRole(role: Role | string): string;
export declare function roleCanAccessDashboard(role: Role | string): boolean;
export declare function permissionsForPath(pathname: string): Permission[] | null;
export declare function roleCanAccessPath(role: Role | string, pathname: string): boolean;
