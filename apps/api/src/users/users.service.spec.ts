import { UsersService } from "./users.service";

const mockPrisma = {
  userOrganization: { findMany: jest.fn() },
};

describe("UsersService", () => {
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(mockPrisma as never);
  });

  it("listMembers queries organization with user include", async () => {
    mockPrisma.userOrganization.findMany.mockResolvedValue([
      { userId: "u1", role: "ADMIN", user: { email: "a@example.com" } },
    ]);

    const rows = await service.listMembers("org-1");

    expect(rows).toHaveLength(1);
    expect(mockPrisma.userOrganization.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      include: { user: true },
    });
  });
});
