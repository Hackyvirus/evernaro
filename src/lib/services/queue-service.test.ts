import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirstMock, updateManyMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  updateManyMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    queueEntry: {
      findFirst: findFirstMock,
      updateMany: updateManyMock,
    },
  },
}));

import { updateQueueEntryStatus, QueueInvalidTransitionError } from "./queue-service";
import { QueueEntryStatus } from "@prisma/client";

describe("updateQueueEntryStatus", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateManyMock.mockReset();
  });

  it("allows WAITING -> CALLED", async () => {
    findFirstMock.mockResolvedValue({ status: QueueEntryStatus.WAITING });
    updateManyMock.mockResolvedValue({ count: 1 });
    await expect(
      updateQueueEntryStatus("entry1", "org1", QueueEntryStatus.CALLED)
    ).resolves.toEqual({ count: 1 });
  });

  it("rejects COMPLETED -> WAITING", async () => {
    findFirstMock.mockResolvedValue({ status: QueueEntryStatus.COMPLETED });
    await expect(
      updateQueueEntryStatus("entry1", "org1", QueueEntryStatus.WAITING)
    ).rejects.toBeInstanceOf(QueueInvalidTransitionError);
  });

  it("returns count 0 for missing entry", async () => {
    findFirstMock.mockResolvedValue(null);
    await expect(
      updateQueueEntryStatus("entry1", "org1", QueueEntryStatus.CALLED)
    ).resolves.toEqual({ count: 0 });
  });
});
