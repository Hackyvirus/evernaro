"use client";

import { useEffect, useState } from "react";
import { Plus, LayoutGrid, Trash2, Pencil } from "lucide-react";
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
import { useRole, isAdmin } from "../role";

const RESOURCE_TYPES = ["TABLE", "BAY", "ROOM", "MACHINE", "DESK", "OTHER"];

type Resource = {
  id: string;
  name: string;
  type: string;
  capacity: number;
  isActive: boolean;
  createdAt: string;
};

export default function ResourcesPage() {
  const role = useRole();
  const { showToast } = useToast();

  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("OTHER");
  const [capacity, setCapacity] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/resources");
      const data = await res.json();
      setResources(data.resources ?? []);
    } catch {
      showToast("error", "Failed to load resources");
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
    setName("");
    setType("OTHER");
    setCapacity("1");
    setIsActive(true);
    setEditing(null);
  }

  function startEdit(resource: Resource) {
    setEditing(resource);
    setName(resource.name);
    setType(resource.type);
    setCapacity(resource.capacity.toString());
    setIsActive(resource.isActive);
    setShowForm(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      name,
      type,
      capacity: Number(capacity),
      isActive,
    };

    try {
      const res = editing
        ? await fetch(`/api/resources/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/resources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to save resource");
        return;
      }
      showToast("success", editing ? "Resource updated" : "Resource created");
      resetForm();
      setShowForm(false);
      load();
    } catch {
      showToast("error", "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteResource(id: string) {
    if (!confirm("Delete this resource?")) return;
    try {
      const res = await fetch(`/api/resources/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        showToast("error", data.error ?? "Failed to delete resource");
        return;
      }
      showToast("success", "Resource deleted");
      load();
    } catch {
      showToast("error", "Network error");
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader title="Resources" description="Manage rooms, tables, bays, machines, and other bookable assets." />

      <div className="flex flex-col gap-4 p-6">
        {isAdmin(role) && (
          <div className="flex justify-end">
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              New resource
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-text-secondary">Loading...</p>
        ) : resources.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="No resources yet" description="Add rooms, tables, machines, or other resources your business uses." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Capacity</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader className="text-right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {resources.map((resource) => (
                <TableRow key={resource.id}>
                  <TableCell className="font-medium text-text">{resource.name}</TableCell>
                  <TableCell className="text-text-secondary">{resource.type}</TableCell>
                  <TableCell className="text-text-secondary">{resource.capacity}</TableCell>
                  <TableCell>
                    <Badge variant={resource.isActive ? "success" : "default"}>
                      {resource.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {isAdmin(role) && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => startEdit(resource)}>
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => deleteResource(resource.id)}>
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </>
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
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text">
                {editing ? "Edit resource" : "New resource"}
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
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
              <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
              <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Input
                label="Capacity"
                type="number"
                min={1}
                required
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="isActive" className="text-sm text-text">
                  Active
                </label>
              </div>
              <div className="flex items-center justify-end gap-2">
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
                <Button type="submit" loading={submitting} disabled={!name}>
                  {editing ? "Save changes" : "Create resource"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
