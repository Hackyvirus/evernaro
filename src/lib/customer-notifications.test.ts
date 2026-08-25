import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirstTemplateMock, findManyChannelMock, sendViaChannelMock } = vi.hoisted(() => ({
  findFirstTemplateMock: vi.fn(),
  findManyChannelMock: vi.fn(),
  sendViaChannelMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    whatsAppTemplate: { findFirst: findFirstTemplateMock },
    channel: { findMany: findManyChannelMock },
  },
}));

vi.mock("@/lib/send", () => ({
  sendViaChannel: sendViaChannelMock,
}));

import { sendQueueNotification } from "./customer-notifications";
import { ChannelType } from "@prisma/client";

const whatsappChannel = {
  id: "channel1",
  orgId: "org1",
  type: ChannelType.WHATSAPP,
  isActive: true,
};

const contact = { id: "contact1", name: "Sushant Atram", phone: "+919356381344", email: null, telegramChatId: null };

const meta = {
  token: "T-1",
  position: 1,
  estimatedWaitMin: 5,
  queueName: "Front Desk",
  businessName: "Saloon",
  verificationCode: "123456",
};

describe("sendQueueNotification WhatsApp template routing", () => {
  beforeEach(() => {
    findFirstTemplateMock.mockReset();
    findManyChannelMock.mockReset();
    sendViaChannelMock.mockReset();
    findManyChannelMock.mockResolvedValue([whatsappChannel]);
    sendViaChannelMock.mockResolvedValue(undefined);
  });

  it("sends via an approved queue_called template when one exists, with the correct ordered params", async () => {
    findFirstTemplateMock.mockResolvedValue({
      id: "tmpl1",
      name: "queue_called",
      status: "APPROVED",
      gupshupTemplateId: "gs-template-id",
      category: "UTILITY",
    });

    await sendQueueNotification("org1", contact as never, "called", meta);

    expect(findFirstTemplateMock).toHaveBeenCalledWith({
      where: { channelId: "channel1", status: "APPROVED", name: "queue_called" },
    });
    expect(sendViaChannelMock).toHaveBeenCalledTimes(1);
    const [, , , , whatsappTemplate] = sendViaChannelMock.mock.calls[0];
    expect(whatsappTemplate).toEqual({
      gupshupTemplateId: "gs-template-id",
      category: "UTILITY",
      params: ["Sushant", "Saloon", "T-1", "123456"],
    });
  });

  it("falls back to free-form (no whatsappTemplate arg) when no approved template exists", async () => {
    findFirstTemplateMock.mockResolvedValue(null);

    await sendQueueNotification("org1", contact as never, "called", meta);

    expect(sendViaChannelMock).toHaveBeenCalledTimes(1);
    const [, , , , whatsappTemplate] = sendViaChannelMock.mock.calls[0];
    expect(whatsappTemplate).toBeUndefined();
  });

  it("ignores a template row that hasn't been confirmed by Gupshup yet (no gupshupTemplateId)", async () => {
    findFirstTemplateMock.mockResolvedValue({
      id: "tmpl1",
      name: "queue_called",
      status: "APPROVED",
      gupshupTemplateId: null,
      category: "UTILITY",
    });

    await sendQueueNotification("org1", contact as never, "called", meta);

    const [, , , , whatsappTemplate] = sendViaChannelMock.mock.calls[0];
    expect(whatsappTemplate).toBeUndefined();
  });

  it("builds params in the joined-event order (no verification code)", async () => {
    findFirstTemplateMock.mockResolvedValue({
      id: "tmpl2",
      name: "queue_joined",
      status: "APPROVED",
      gupshupTemplateId: "gs-joined-id",
      category: "UTILITY",
    });

    await sendQueueNotification("org1", contact as never, "joined", meta);

    const [, , , , whatsappTemplate] = sendViaChannelMock.mock.calls[0];
    expect(whatsappTemplate).toEqual({
      gupshupTemplateId: "gs-joined-id",
      category: "UTILITY",
      params: ["Sushant", "Saloon", "T-1", "1", "5"],
    });
  });
});
