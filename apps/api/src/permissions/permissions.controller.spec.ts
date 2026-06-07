import { Role, Permission } from "@erp/types";
import type { TenantContext } from "@erp/types";
import { roleHasPermission } from "@erp/utils";
import { PermissionsController } from "./permissions.controller";

describe("PermissionsController", () => {
  const controller = new PermissionsController();

  it("returns role and permissions granted to tenant role", () => {
    const tenant: TenantContext = {
      organizationId: "org_1",
      branchId: "br_1",
      userId: "usr_1",
      role: Role.ACCOUNTANT,
    };

    const result = controller.myPermissions(tenant);

    expect(result.role).toBe(Role.ACCOUNTANT);
    expect(result.permissions).toEqual(
      Object.values(Permission).filter((p) => roleHasPermission(Role.ACCOUNTANT, p)),
    );
    expect(result.permissions).toContain(Permission.ACCOUNTING_READ);
    expect(result.permissions).not.toContain(Permission.PMS_WRITE);
  });
});
