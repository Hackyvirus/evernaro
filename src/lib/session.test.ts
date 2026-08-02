import { describe, expect, it, vi, beforeEach } from "vitest";

const { authMock, findUniqueUserMock, findUniquePlatformAdminMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUniqueUserMock: vi.fn(),
  findUniquePlatformAdminMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: findUniqueUserMock },
    platformAdmin: { findUnique: findUniquePlatformAdminMock },
  },
}));

import { requireOrgId, requirePlatformAdminId, UnauthorizedError } from "./session";

beforeEach(() => {
  authMock.mockReset();
  findUniqueUserMock.mockReset();
  findUniquePlatformAdminMock.mockReset();
});

describe("requireOrgId", () => {
  it("throws when there's no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireOrgId()).rejects.toThrow(UnauthorizedError);
  });

  it("throws when the DB no longer has this user in the session's org — the whole point of this re-check", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1", orgId: "org_A" } });
    // User was moved to a different org (or removed) since the JWT was issued.
    findUniqueUserMock.mockResolvedValue({ orgId: "org_B" });
    await expect(requireOrgId()).rejects.toThrow(UnauthorizedError);
  });

  it("throws when the user record is gone entirely", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1", orgId: "org_A" } });
    findUniqueUserMock.mockResolvedValue(null);
    await expect(requireOrgId()).rejects.toThrow(UnauthorizedError);
  });

  it("returns the orgId when the session and DB agree", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1", orgId: "org_A" } });
    findUniqueUserMock.mockResolvedValue({ orgId: "org_A" });
    await expect(requireOrgId()).resolves.toBe("org_A");
  });
});

describe("requirePlatformAdminId", () => {
  it("throws when the session user isn't flagged as a platform admin", async () => {
    authMock.mockResolvedValue({ user: { id: "user_1", isPlatformAdmin: false } });
    await expect(requirePlatformAdminId()).rejects.toThrow(UnauthorizedError);
  });

  it("throws when the admin record no longer exists", async () => {
    authMock.mockResolvedValue({ user: { id: "admin_1", isPlatformAdmin: true } });
    findUniquePlatformAdminMock.mockResolvedValue(null);
    await expect(requirePlatformAdminId()).rejects.toThrow(UnauthorizedError);
  });

  it("returns the admin id when everything checks out", async () => {
    authMock.mockResolvedValue({ user: { id: "admin_1", isPlatformAdmin: true } });
    findUniquePlatformAdminMock.mockResolvedValue({ id: "admin_1" });
    await expect(requirePlatformAdminId()).resolves.toBe("admin_1");
  });
});
