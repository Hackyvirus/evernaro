"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Wrench, Trash2, Pencil } from "lucide-react";
import {
  Button,
  Card,
  Input,
  PageHeader,
  Select,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  Badge,
  EmptyState,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { contactLabel } from "@/lib/contact-label";
import { useRole, isAgentOrAbove, isAdmin } from "../role";

const JOB_STATUSES = [
  "RECEIVED",
  "INSPECTION",
  "ESTIMATE",
  "APPROVED",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "READY",
  "DELIVERED",
];

type Contact = { id: string; name: string | null; email: string | null; phone: string | null; telegramChatId: string | null; instagramUserId: string | null };
type Service = { id: string; name: string };
type Staff = { id: string; name: string };

type JobCard = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  estimateInr: number | null;
  createdAt: string;
  approvedAt: string | null;
  completedAt: string | null;
  deliveredAt: string | null;
  contact: Contact;
  service: Service | null;
  staff: Staff | null;
};

export default function JobsPage() {
  const role = useRole();
  const { showToast } = useToast();

  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<JobCard | null>(null);

  const [contactId, setContactId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [estimateInr, setEstimateInr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [jobsRes, contactsRes, servicesRes, staffRes] = await Promise.all([
        fetch("/api/jobs"),
        fetch("/api/contacts"),
        fetch("/api/services"),
        fetch("/api/staff"),
      ]);
      const jobsData = await jobsRes.json();
      const contactsData = await contactsRes.json();
      const servicesData = await servicesRes.json();
      const staffData = await staffRes.json();
      setJobCards(jobsData.jobCards ?? []);
      setContacts(contactsData.contacts ?? []);
      setServices(servicesData.services ?? []);
      setStaff(staffData.staff ?? []);
    } catch {
      showToast("error", "Failed to load job cards");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setContactId("");
    setServiceId("");
    setStaffId("");
    setTitle("");
    setDescription("");
    setEstimateInr("");
    setEditing(null);
  }

  function startEdit(job: JobCard) {
    setEditing(job);
    setContactId(job.contact.id);
    setServiceId(job.service?.id ?? "");
    setStaffId(job.staff?.id ?? "");
    setTitle(job.title);
    setDescription(job.description ?? "");
    setEstimateInr(job.estimateInr?.toString() ?? "");
    setShowForm(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      contactId,
      serviceId: serviceId || undefined,
      staffId: staffId || undefined,
      title,
      description: description || undefined,
      estimateInr: estimateInr ? Number(estimateInr) : undefined,
    };

    try {
      const res = editing
        ? await fetch(`/api/jobs/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to save job card");
        return;
      }
      showToast("success", editing ? "Job card updated" : "Job card created");
      resetForm();
      setShowForm(false);
      load();
    } catch {
      showToast("error", "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(job: JobCard, nextStatus: string) {
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to update status");
        return;
      }
      showToast("success", `Status updated to ${nextStatus}`);
      load();
    } catch {
      showToast("error", "Network error");
    }
  }

  async function deleteJob(id: string) {
    if (!confirm("Delete this job card?")) return;
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        showToast("error", data.error ?? "Failed to delete job card");
        return;
      }
      showToast("success", "Job card deleted");
      load();
    } catch {
      showToast("error", "Network error");
    }
  }

  function statusVariant(status: string): "default" | "success" | "warning" | "danger" | "info" | "primary" {
    switch (status) {
      case "DELIVERED":
        return "success";
      case "READY":
        return "success";
      case "APPROVED":
        return "primary";
      case "IN_PROGRESS":
        return "info";
      case "QUALITY_CHECK":
        return "warning";
      case "ESTIMATE":
        return "warning";
      case "INSPECTION":
        return "default";
      default:
        return "default";
    }
  }

  function nextStatus(status: string): string | null {
    const index = JOB_STATUSES.indexOf(status);
    if (index === -1 || index === JOB_STATUSES.length - 1) return null;
    return JOB_STATUSES[index + 1];
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader title="Job Cards" description="Track repair and service jobs from intake to delivery." />

      <div className="flex flex-col gap-4 p-6">
        {isAgentOrAbove(role) && (
          <div className="flex justify-end">
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              New job card
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-text-secondary">Loading...</p>
        ) : jobCards.length === 0 ? (
          <EmptyState icon={Wrench} title="No job cards yet" description="Create a job card to start tracking work." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Job</TableHeader>
                <TableHeader>Customer</TableHeader>
                <TableHeader>Service</TableHeader>
                <TableHeader>Staff</TableHeader>
                <TableHeader>Estimate</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader className="text-right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobCards.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-text">{job.title}</p>
                      {job.description && <p className="text-xs text-text-secondary line-clamp-1">{job.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link href={`/contacts/${job.contact.id}`} className="text-sm text-primary hover:underline">
                      {contactLabel(job.contact)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-text-secondary">{job.service?.name ?? "—"}</TableCell>
                  <TableCell className="text-text-secondary">{job.staff?.name ?? "—"}</TableCell>
                  <TableCell className="text-text-secondary">
                    {job.estimateInr !== null ? `₹${job.estimateInr}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(job.status)}>{job.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {isAgentOrAbove(role) && nextStatus(job.status) && (
                        <Button size="sm" variant="secondary" onClick={() => updateStatus(job, nextStatus(job.status)!)}>
                          {nextStatus(job.status)!.replace(/_/g, " ")}
                        </Button>
                      )}
                      {isAgentOrAbove(role) && (
                        <Button size="sm" variant="secondary" onClick={() => startEdit(job)}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                      {isAdmin(role) && (
                        <Button size="sm" variant="danger" onClick={() => deleteJob(job.id)}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text">
                {editing ? "Edit job card" : "New job card"}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-text-muted hover:text-text"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Select label="Customer" required value={contactId} onChange={(e) => setContactId(e.target.value)}>
                  <option value="">Select customer</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {contactLabel(c)}
                    </option>
                  ))}
                </Select>
              </div>
              <Select label="Service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                <option value="">None</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select label="Staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">None</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="sm:col-span-2"
              />
              <Input
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="sm:col-span-2"
              />
              <Input
                label="Estimate (₹)"
                type="number"
                min={0}
                value={estimateInr}
                onChange={(e) => setEstimateInr(e.target.value)}
              />
              <div className="flex items-end">
                <p className="text-xs text-text-muted">
                  Status transitions follow the workflow: Received → Inspection → Estimate → Approved → In Progress → Quality Check → Ready → Delivered.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={submitting} disabled={!contactId || !title}>
                  {editing ? "Save changes" : "Create job card"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
