import { describe, it, expect } from "vitest";
import { getDefaultRouteForRole, roleCanAccessPath, roleHasPermission } from "./rbac";
import { Permission, Role } from "@erp/types";

describe("rbac helpers", () => {
  it("getDefaultRouteForRole maps FRONT_DESK to PMS", () => {
    expect(getDefaultRouteForRole(Role.FRONT_DESK)).toBe("/pms");
  });

  it("getDefaultRouteForRole maps OWNER to dashboard", () => {
    expect(getDefaultRouteForRole(Role.OWNER)).toBe("/dashboard");
  });

  it("FRONT_DESK can access PMS but not HR or dashboard", () => {
    expect(roleHasPermission(Role.FRONT_DESK, Permission.PMS_READ)).toBe(true);
    expect(roleCanAccessPath(Role.FRONT_DESK, "/pms")).toBe(true);
    expect(roleCanAccessPath(Role.FRONT_DESK, "/hr")).toBe(false);
    expect(roleCanAccessPath(Role.FRONT_DESK, "/dashboard")).toBe(false);
  });

  it("CASHIER is redirected away from dashboard", () => {
    expect(roleCanAccessPath(Role.CASHIER, "/dashboard")).toBe(false);
    expect(getDefaultRouteForRole(Role.CASHIER)).toBe("/pos");
  });

  it("KITCHEN default route is kitchen display", () => {
    expect(getDefaultRouteForRole(Role.KITCHEN)).toBe("/pos/kitchen");
  });
});
