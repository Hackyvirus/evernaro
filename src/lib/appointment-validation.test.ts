import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateAppointmentRelations } from "./appointment-validation";
import { prisma } from "./prisma";

vi.mock("./prisma", () => ({
  prisma: {
    contact: { findFirst: vi.fn() },
    service: { findFirst: vi.fn() },
    staffProfile: { findFirst: vi.fn() },
    resource: { findFirst: vi.fn() },
    location: { findFirst: vi.fn() },
  },
}));

const orgId = "org_1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateAppointmentRelations", () => {
  it("returns ok when all relations belong to the org", async () => {
    (prisma.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "c1" });
    (prisma.service.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "s1" });
    (prisma.staffProfile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "st1" });
    (prisma.resource.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "r1" });
    (prisma.location.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "l1" });

    const result = await validateAppointmentRelations(orgId, {
      contactId: "c1",
      serviceId: "s1",
      staffId: "st1",
      resourceId: "r1",
      locationId: "l1",
    });

    expect(result).toEqual({ ok: true });
  });

  it("fails when contact belongs to another org", async () => {
    (prisma.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await validateAppointmentRelations(orgId, { contactId: "c1" });

    expect(result).toEqual({ ok: false, error: "Contact not found", status: 404 });
  });

  it("fails when service is inactive or belongs to another org", async () => {
    (prisma.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "c1" });
    (prisma.service.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await validateAppointmentRelations(orgId, { contactId: "c1", serviceId: "s1" });

    expect(result).toEqual({ ok: false, error: "Service not found or inactive", status: 404 });
  });

  it("fails when staff belongs to another org", async () => {
    (prisma.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "c1" });
    (prisma.staffProfile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await validateAppointmentRelations(orgId, { contactId: "c1", staffId: "st1" });

    expect(result).toEqual({ ok: false, error: "Staff member not found or inactive", status: 404 });
  });

  it("fails when resource belongs to another org", async () => {
    (prisma.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "c1" });
    (prisma.resource.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await validateAppointmentRelations(orgId, { contactId: "c1", resourceId: "r1" });

    expect(result).toEqual({ ok: false, error: "Resource not found or inactive", status: 404 });
  });

  it("fails when location belongs to another org", async () => {
    (prisma.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "c1" });
    (prisma.location.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await validateAppointmentRelations(orgId, { contactId: "c1", locationId: "l1" });

    expect(result).toEqual({ ok: false, error: "Location not found or inactive", status: 404 });
  });
});
