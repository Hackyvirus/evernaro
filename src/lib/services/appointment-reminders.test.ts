import { describe, it, expect, vi, beforeEach } from "vitest";

const { appointmentFindUniqueMock, templateFindFirstMock, channelFindManyMock, reminderCreateMock, enqueueReminderMock } =
  vi.hoisted(() => ({
    appointmentFindUniqueMock: vi.fn(),
    templateFindFirstMock: vi.fn(),
    channelFindManyMock: vi.fn(),
    reminderCreateMock: vi.fn(),
    enqueueReminderMock: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: { findUnique: appointmentFindUniqueMock },
    whatsAppTemplate: { findFirst: templateFindFirstMock },
    channel: { findMany: channelFindManyMock },
    reminder: { create: reminderCreateMock },
  },
}));

vi.mock("@/lib/queue", () => ({ enqueueReminder: enqueueReminderMock }));

import { scheduleAppointmentReminders, buildAppointmentReminderParams } from "./appointment-reminders";
import { ChannelType } from "@prisma/client";

describe("buildAppointmentReminderParams", () => {
  it("orders params as name, service, business, date, time in the org timezone", () => {
    const params = buildAppointmentReminderParams({
      contactName: "Priya Sharma",
      serviceName: "Follow-up Visit",
      businessName: "Sunrise Clinic",
      // 2026-08-28T09:30:00Z == 15:00 in Asia/Kolkata
      startsAt: new Date("2026-08-28T09:30:00.000Z"),
      timeZone: "Asia/Kolkata",
    });
    expect(params).toEqual(["Priya Sharma", "Follow-up Visit", "Sunrise Clinic", "Fri, 28 Aug", "03:00 pm"]);
  });

  it("falls back to 'there' when the contact has no name", () => {
    const params = buildAppointmentReminderParams({
      contactName: null,
      serviceName: "Consultation",
      businessName: "Clinic",
      startsAt: new Date("2026-08-28T09:30:00.000Z"),
      timeZone: "Asia/Kolkata",
    });
    expect(params[0]).toBe("there");
  });
});

describe("scheduleAppointmentReminders", () => {
  const futureStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const baseAppointment = {
    id: "appt1",
    orgId: "org1",
    startsAt: futureStart,
    contact: { id: "contact1", name: "Priya Sharma", phone: "+919000000000", email: null, telegramChatId: null },
    service: { name: "Follow-up Visit" },
    staff: { name: "Dr. Rao" },
    org: { id: "org1", name: "Sunrise Clinic", timezone: "Asia/Kolkata", channels: [] },
  };
  const whatsappChannel = { id: "channel1", orgId: "org1", type: ChannelType.WHATSAPP, isActive: true };

  beforeEach(() => {
    appointmentFindUniqueMock.mockReset();
    templateFindFirstMock.mockReset();
    channelFindManyMock.mockReset();
    reminderCreateMock.mockReset();
    enqueueReminderMock.mockReset();
    channelFindManyMock.mockResolvedValue([whatsappChannel]);
    reminderCreateMock.mockImplementation(({ data }) => Promise.resolve({ id: "rem1", ...data }));
    enqueueReminderMock.mockResolvedValue(undefined);
  });

  it("stores the full ordered templateParams when an approved *reminder* template exists", async () => {
    appointmentFindUniqueMock.mockResolvedValue(baseAppointment);
    templateFindFirstMock.mockResolvedValue({ id: "tmpl1", name: "appointment_reminder", status: "APPROVED" });

    await scheduleAppointmentReminders("appt1");

    expect(reminderCreateMock).toHaveBeenCalledTimes(2); // 24h + 2h
    for (const call of reminderCreateMock.mock.calls) {
      expect(call[0].data.whatsappTemplateId).toBe("tmpl1");
      expect(call[0].data.templateParams).toEqual([
        "Priya Sharma",
        "Follow-up Visit",
        "Sunrise Clinic",
        expect.any(String),
        expect.any(String),
      ]);
    }
  });

  it("stores empty templateParams (free-form fallback) when no template exists", async () => {
    appointmentFindUniqueMock.mockResolvedValue(baseAppointment);
    templateFindFirstMock.mockResolvedValue(null);

    await scheduleAppointmentReminders("appt1");

    expect(reminderCreateMock).toHaveBeenCalledTimes(2);
    for (const call of reminderCreateMock.mock.calls) {
      expect(call[0].data.whatsappTemplateId).toBeNull();
      expect(call[0].data.templateParams).toEqual([]);
    }
  });
});
