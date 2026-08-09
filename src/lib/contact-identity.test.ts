import { describe, expect, it, vi, beforeEach } from "vitest";

const { findFirstMock, createMock, updateMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((fn) => fn({
      contact: {
        findFirst: findFirstMock,
        create: createMock,
        update: updateMock,
      },
    })),
  },
}));

import { findOrCreateContact } from "./contact-identity";

beforeEach(() => {
  findFirstMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
});

describe("findOrCreateContact", () => {
  it("creates a new contact when no identifier matches", async () => {
    findFirstMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: "c1", orgId: "o1", phone: "+919876543210", email: null });

    const result = await findOrCreateContact({ phone: "919876543210" }, "o1");

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        orgId: "o1",
        OR: [{ phone: "+919876543210" }],
      },
    });
    expect(createMock).toHaveBeenCalledWith({
      data: {
        orgId: "o1",
        name: null,
        phone: "+919876543210",
        email: null,
        telegramChatId: null,
        instagramUserId: null,
      },
    });
    expect(result.phone).toBe("+919876543210");
  });

  it("finds an existing contact by phone", async () => {
    const existing = { id: "c1", orgId: "o1", phone: "+919876543210", email: null, name: "Alice" };
    findFirstMock.mockResolvedValue(existing);

    const result = await findOrCreateContact({ phone: "919876543210" }, "o1");

    expect(createMock).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it("finds an existing contact by email and lowercases the input", async () => {
    const existing = { id: "c1", orgId: "o1", phone: null, email: "alice@example.com", name: "Alice" };
    findFirstMock.mockResolvedValue(existing);

    const result = await findOrCreateContact({ email: "Alice@Example.COM" }, "o1");

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        orgId: "o1",
        OR: [{ email: "alice@example.com" }],
      },
    });
    expect(result).toBe(existing);
  });

  it("finds an existing contact by telegramChatId", async () => {
    const existing = { id: "c1", orgId: "o1", telegramChatId: "12345", name: "Telegram User" };
    findFirstMock.mockResolvedValue(existing);

    const result = await findOrCreateContact({ telegramChatId: "12345" }, "o1");

    expect(createMock).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it("finds an existing contact by instagramUserId", async () => {
    const existing = { id: "c1", orgId: "o1", instagramUserId: "ig-1", name: "IG User" };
    findFirstMock.mockResolvedValue(existing);

    const result = await findOrCreateContact({ instagramUserId: "ig-1" }, "o1");

    expect(createMock).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it("updates a missing name but does not overwrite an existing name with an empty value", async () => {
    const existing = { id: "c1", orgId: "o1", phone: "+919876543210", email: null, name: null };
    findFirstMock.mockResolvedValue(existing);
    updateMock.mockResolvedValue({ ...existing, name: "Alice" });

    const result = await findOrCreateContact({ phone: "919876543210", name: "  Alice  " }, "o1");

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { name: "Alice" },
    });
    expect(result.name).toBe("Alice");
  });

  it("does not overwrite an existing name with an empty value", async () => {
    const existing = { id: "c1", orgId: "o1", phone: "+919876543210", email: null, name: "Alice" };
    findFirstMock.mockResolvedValue(existing);

    const result = await findOrCreateContact({ phone: "919876543210", name: "" }, "o1");

    expect(updateMock).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it("fills in a missing email on an existing contact", async () => {
    const existing = { id: "c1", orgId: "o1", phone: "+919876543210", email: null, name: "Alice" };
    findFirstMock.mockResolvedValue(existing);
    updateMock.mockResolvedValue({ ...existing, email: "alice@example.com" });

    await findOrCreateContact({ phone: "919876543210", email: "Alice@Example.COM" }, "o1");

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { email: "alice@example.com" },
    });
  });

  it("looks up by any provided identifier", async () => {
    findFirstMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ id: "c1", orgId: "o1" });

    await findOrCreateContact(
      { phone: "919876543210", email: "alice@example.com", telegramChatId: "123", instagramUserId: "ig" },
      "o1"
    );

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        orgId: "o1",
        OR: [
          { phone: "+919876543210" },
          { email: "alice@example.com" },
          { telegramChatId: "123" },
          { instagramUserId: "ig" },
        ],
      },
    });
  });

  it("throws when no identifier is provided", async () => {
    await expect(findOrCreateContact({ name: "Alice" }, "o1")).rejects.toThrow(
      "At least one of phone, email, telegramChatId, or instagramUserId is required"
    );
  });

  it("retries on unique constraint violation from a concurrent create", async () => {
    const existing = { id: "c1", orgId: "o1", phone: "+919876543210", name: "Alice" };
    findFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    createMock.mockRejectedValueOnce({ code: "P2002" });

    const result = await findOrCreateContact({ phone: "919876543210" }, "o1");

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(findFirstMock).toHaveBeenCalledTimes(2);
    expect(result).toBe(existing);
  });
});
