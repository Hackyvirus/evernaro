import { describe, it, expect, vi, beforeEach } from "vitest";

const { findManyMock, updateMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findMany: findManyMock,
      update: updateMock,
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { generateApiKey, apiKeyPrefix, authenticateApiKey, hashApiKey } from "./api-key-auth";

describe("api-key-auth", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    updateMock.mockReset();
  });

  it("generateApiKey produces evr_live_ prefixed keys", () => {
    const key = generateApiKey();
    expect(key.startsWith("evr_live_")).toBe(true);
    expect(key.length).toBeGreaterThan(20);
  });

  it("apiKeyPrefix returns the first 16 characters", () => {
    expect(apiKeyPrefix("evr_live_abc123")).toBe("evr_live_abc123");
    expect(apiKeyPrefix("short")).toBe("short");
  });

  it("authenticateApiKey queries by prefix", async () => {
    const plaintext = generateApiKey();
    const keyHash = await hashApiKey(plaintext);
    findManyMock.mockResolvedValue([
      {
        id: "k1",
        keyHash,
        scopes: ["read"],
        expiresAt: null,
        org: { status: "ACTIVE" },
        orgId: "org1",
      },
    ]);

    const result = await authenticateApiKey(
      new Request("https://example.com", { headers: { authorization: `Bearer ${plaintext}` } })
    );

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ keyPrefix: apiKeyPrefix(plaintext), isActive: true }),
      })
    );
    expect(result).toEqual({ orgId: "org1", scopes: ["read"] });
  });

  it("authenticateApiKey returns null when no key matches", async () => {
    findManyMock.mockResolvedValue([]);
    const result = await authenticateApiKey(
      new Request("https://example.com", { headers: { authorization: "Bearer evr_live_invalid" } })
    );
    expect(result).toBeNull();
  });
});
