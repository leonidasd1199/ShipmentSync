import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue("hashed"),
}));
import bcrypt from "bcryptjs";

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => "user-id-1" },
    email: "test@example.com",
    firstName: "John",
    lastName: "Doe",
    roleCode: "ops_admin",
    isActive: true,
    password: "hashed-password",
    mustChangePassword: false,
    company: null,
    offices: [],
    permissions: [],
    ...overrides,
  };
}

function buildMocks() {
  const chainable = { populate: jest.fn(), exec: jest.fn() };
  chainable.populate.mockReturnValue(chainable);

  const userModel = {
    findOne: jest.fn().mockReturnValue(chainable),
    findById: jest.fn().mockReturnValue(chainable),
    findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn() }),
  };
  const agentModel = {
    findById: jest.fn().mockReturnValue({ exec: jest.fn() }),
  };
  const jwtService = { sign: jest.fn().mockReturnValue("jwt-token") };

  const service = new AuthService(
    userModel as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    agentModel as any,
    jwtService as any,
  );

  return { service, userModel, agentModel, jwtService, chainable };
}

describe("AuthService", () => {
  afterEach(() => jest.clearAllMocks());

  describe("login", () => {
    it("throws NotFoundException when user does not exist", async () => {
      const { service, chainable } = buildMocks();
      chainable.exec.mockResolvedValue(null);

      await expect(service.login("no@one.com", "pass")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws UnauthorizedException when user is inactive", async () => {
      const { service, chainable } = buildMocks();
      chainable.exec.mockResolvedValue(buildUser({ isActive: false }));

      await expect(service.login("test@example.com", "pass")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("throws UnauthorizedException on wrong password", async () => {
      const { service, chainable } = buildMocks();
      chainable.exec.mockResolvedValue(buildUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login("test@example.com", "wrong"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("returns access_token and user shape on valid credentials", async () => {
      const { service, userModel, chainable, jwtService } = buildMocks();
      chainable.exec.mockResolvedValue(buildUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      userModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn() });

      const result = await service.login("test@example.com", "correct");

      expect(result.access_token).toBe("jwt-token");
      expect(result.user.email).toBe("test@example.com");
      expect(result.user.roleCode).toBe("ops_admin");
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ email: "test@example.com" }),
      );
    });
  });

  describe("getUserPermissions", () => {
    it("throws NotFoundException when user does not exist", async () => {
      const { service, userModel } = buildMocks();
      userModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      });

      await expect(service.getUserPermissions("missing-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("returns an array of permission codes", async () => {
      const { service, userModel } = buildMocks();
      const userWithPerms = buildUser({
        permissions: [{ code: "client:read" }, { code: "quotation:create" }],
      });
      userModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(userWithPerms) }),
      });

      const codes = await service.getUserPermissions("user-id-1");

      expect(codes).toEqual(["client:read", "quotation:create"]);
    });
  });

  describe("loginAgent", () => {
    it("throws NotFoundException when agent does not exist", async () => {
      const { service, agentModel } = buildMocks();
      agentModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.loginAgent("bad-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("returns a JWT token for an active agent", async () => {
      const { service, agentModel, jwtService } = buildMocks();
      agentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: { toString: () => "agent-1" },
          email: "agent@partner.com",
          isActive: true,
        }),
      });

      const token = await service.loginAgent("agent-1");

      expect(token).toBe("jwt-token");
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ roleCode: "AGENT" }),
      );
    });
  });
});
