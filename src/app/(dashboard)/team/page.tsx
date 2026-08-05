"use client";

import { useEffect, useState } from "react";
import { Users, Plus, X, UserX, UserCheck, Shield, User, Eye, Mail } from "lucide-react";
import { Button, Card, EmptyState, Input, PageHeader, Select, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, SkeletonTable, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { RoleAwareAdminGuard } from "../role";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "AGENT" | "VIEWER";
  isActive: boolean;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  AGENT: "Agent",
  VIEWER: "Viewer",
};

const roleOrder = ["OWNER", "ADMIN", "AGENT", "VIEWER"];

export default function TeamPage() {
  return (
    <RoleAwareAdminGuard>
      <TeamPageContent />
    </RoleAwareAdminGuard>
  );
}

function TeamPageContent() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"AGENT" | "VIEWER" | "ADMIN">("AGENT");
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const r = await fetch("/api/users");
        const d = await r.json();
        if (active) setUsers(d.users ?? []);
      } catch {
        showToast("error", "Failed to load team");
      } finally {
        if (active) setLoaded(true);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [showToast]);

  async function invite() {
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      const d = await r.json();
      if (!r.ok) {
        showToast("error", d.error ?? "Invite failed");
        return;
      }
      setUsers((prev) => [d.user, ...prev]);
      setTempPassword(d.tempPassword);
      setName("");
      setEmail("");
      setRole("AGENT");
      showToast("success", "Team member invited");
    } catch {
      showToast("error", "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(id: string, patch: Partial<TeamUser>) {
    try {
      const r = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await r.json();
      if (!r.ok) {
        showToast("error", d.error ?? "Update failed");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? d.user : u)));
      showToast("success", "Team member updated");
    } catch {
      showToast("error", "Network error");
    }
  }

  async function removeUser(id: string) {
    if (!confirm("Remove this team member? They will lose access immediately.")) return;
    try {
      const r = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        showToast("error", d.error ?? "Remove failed");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showToast("success", "Team member removed");
    } catch {
      showToast("error", "Network error");
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Team"
        description="Invite members, assign roles, and manage access."
      >
        <Button onClick={() => setShowInvite(true)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Invite member
        </Button>
      </PageHeader>

      <div className="p-6">
        {!loaded ? (
          <SkeletonTable rows={4} columns={5} />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No team members" description="Invite your first team member to get started." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Email</TableHeader>
                <TableHeader>Role</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader className="text-right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {users
                .sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role))
                .map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-text-muted" aria-hidden="true" />
                        <span className="font-medium text-text">{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-text-secondary">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "OWNER" ? "success" : "default"} className="text-xs">
                        {roleLabels[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "success" : "danger"} className="text-xs">
                        {u.isActive ? "Active" : "Suspended"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.role !== "OWNER" && (
                          <Select
                            value={u.role}
                            onChange={(e) => updateUser(u.id, { role: e.target.value as TeamUser["role"] })}
                            className="h-8 w-28 text-xs"
                            aria-label={`Change role for ${u.name}`}
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="AGENT">Agent</option>
                            <option value="VIEWER">Viewer</option>
                          </Select>
                        )}
                        {u.role !== "OWNER" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                            title={u.isActive ? "Suspend" : "Reactivate"}
                          >
                            {u.isActive ? <UserX className="h-4 w-4" aria-hidden="true" /> : <UserCheck className="h-4 w-4" aria-hidden="true" />}
                          </Button>
                        )}
                        {u.role !== "OWNER" && (
                          <Button size="sm" variant="ghost" onClick={() => removeUser(u.id)} title="Remove">
                            <X className="h-4 w-4" aria-hidden="true" />
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

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text">Invite team member</h2>
              <button
                onClick={() => {
                  setShowInvite(false);
                  setTempPassword(null);
                }}
                className="text-text-muted hover:text-text"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {!tempPassword ? (
              <div className="space-y-3">
                <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                  <option value="ADMIN">Admin — manage team and settings</option>
                  <option value="AGENT">Agent — inbox, contacts, campaigns</option>
                  <option value="VIEWER">Viewer — read-only</option>
                </Select>
                <div className="rounded-md bg-surface p-3 text-xs text-text-secondary">
                  <p className="flex items-center gap-1.5 font-medium text-text">
                    <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                    Role permissions
                  </p>
                  <ul className="mt-1 space-y-1">
                    <li className="flex items-center gap-1.5"><Eye className="h-3 w-3" aria-hidden="true" /> Viewer: read analytics and inbox only</li>
                    <li className="flex items-center gap-1.5"><Mail className="h-3 w-3" aria-hidden="true" /> Agent: can send messages and run campaigns</li>
                    <li className="flex items-center gap-1.5"><Shield className="h-3 w-3" aria-hidden="true" /> Admin: manage team, channels, and billing</li>
                  </ul>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
                  <Button onClick={invite} loading={saving} disabled={!name.trim() || !email.trim()}>
                    Send invite
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">
                  <span className="font-medium text-text">{name}</span> has been added. Share this temporary password with them securely:
                </p>
                <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
                  <code className="text-sm text-text">{tempPassword}</code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPassword ?? "");
                      showToast("success", "Copied to clipboard");
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-text-muted">They can log in with their email and this password. A password reset flow will be added soon.</p>
                <div className="flex justify-end">
                  <Button onClick={() => { setShowInvite(false); setTempPassword(null); }}>Done</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
