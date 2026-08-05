import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUniqueOrgMock } = vi.hoisted(() => ({
  findUniqueOrgMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findUnique: findUniqueOrgMock },
  },
}));

import { requireActiveSubscription, SubscriptionSuspendedError, getSubscriptionStatus } from "./subscription";
import { OrganizationStatus } from "@prisma/client";

beforeEach(() => {
  findUniqueOrgMock.mockReset();
});

describe("requireActiveSubscription", () => {
  it("throws for a suspended organization", async () => {
    findUniqueOrgMock.mockResolvedValue({ status: OrganizationStatus.SUSPENDED, name: "Suspended" });
    await expect(requireActiveSubscription("org_1")).rejects.toBeInstanceOf(SubscriptionSuspendedError);
  });

  it("throws for a past-due organization", async () => {
    findUniqueOrgMock.mockResolvedValue({ status: OrganizationStatus.PAST_DUE, name: "Past Due" });
    await expect(requireActiveSubscription("org_1")).rejects.toBeInstanceOf(SubscriptionSuspendedError);
  });

  it("passes for an active organization", async () => {
    findUniqueOrgMock.mockResolvedValue({ status: OrganizationStatus.ACTIVE, name: "Active" });
    await expect(requireActiveSubscription("org_1")).resolves.toBeUndefined();
  });

  it("throws when organization is not found", async () => {
    findUniqueOrgMock.mockResolvedValue(null);
    await expect(requireActiveSubscription("org_1")).rejects.toBeInstanceOf(SubscriptionSuspendedError);
  });
});

describe("getSubscriptionStatus", () => {
  it("returns the organization's status", async () => {
    findUniqueOrgMock.mockResolvedValue({ status: OrganizationStatus.ACTIVE });
    await expect(getSubscriptionStatus("org_1")).resolves.toBe(OrganizationStatus.ACTIVE);
  });

  it("defaults to ACTIVE when organization is missing", async () => {
    findUniqueOrgMock.mockResolvedValue(null);
    await expect(getSubscriptionStatus("org_1")).resolves.toBe(OrganizationStatus.ACTIVE);
  });
});
