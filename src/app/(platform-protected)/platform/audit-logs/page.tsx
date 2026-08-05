"use client";

import { useEffect, useState } from "react";
import { Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, Button, Card, Input, PageHeader, Select, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

interface OrgSummary {
  id: string;
  name: string;
  slug: string;
}

interface AuditLog {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  result: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  org: OrgSummary | null;
  user: { id: string; name: string | null; email: string } | null;
  platformAdmin: { id: string; name: string | null; email: string } | null;
}

const ACTIONS = [
  "ORG_CREATED", "ORG_SUSPENDED", "ORG_REACTIVATED", "ORG_PLAN_CHANGED", "ORG_DELETED",
  "USER_INVITED", "USER_ROLE_CHANGED", "USER_SUSPENDED", "USER_REACTIVATED", "USER_REMOVED",
  "CHANNEL_CONNECTED", "CHANNEL_DISCONNECTED", "CHANNEL_TESTED",
  "WALLET_MANUAL_CREDIT", "WALLET_MANUAL_DEBIT", "WALLET_THRESHOLD_CHANGED",
  "INVOICE_GENERATED", "INVOICE_PAID", "INVOICE_FAILED", "INVOICE_CANCELLED",
  "CAMPAIGN_CREATED", "CAMPAIGN_CANCELLED", "REMINDER_CREATED", "REMINDER_CANCELLED",
  "SETTINGS_CHANGED", "KNOWLEDGE_BASE_CHANGED", "CONVERSATION_UPDATED", "OTHER",
];

function resultVariant(result: string): "default" | "success" | "warning" | "danger" | "info" {
  if (result === "SUCCESS") return "success";
  if (result === "FAILURE") return "danger";
  return "default";
}

export default function PlatformAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [loaded, setLoaded] = useState(false);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [orgId, setOrgId] = useState("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");

  useEffect(() => {
    fetch("/api/platform/organizations")
      .then((r) => r.json())
      .then((d) => setOrgs(d.organizations ?? []));
  }, []);

  useEffect(() => {
    async function load() {
      setLoaded(false);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (orgId) params.set("orgId", orgId);
      if (action) params.set("action", action);
      if (targetType) params.set("targetType", targetType);
      try {
        const res = await fetch(`/api/platform/audit-logs?${params.toString()}`);
        const data = await res.json();
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
      } finally {
        setLoaded(true);
      }
    }
    void load();
  }, [page, limit, orgId, action, targetType]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Audit logs"
        description="Trace of platform and organization actions taken by admins and users."
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <Select label="Organization" value={orgId} onChange={(e) => { setOrgId(e.target.value); setPage(1); }}>
              <option value="">All organizations</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </div>
          <div className="w-full lg:w-56">
            <Select label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">All actions</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </div>
          <div className="w-full lg:w-48">
            <Input
              label="Target type"
              type="text"
              placeholder="e.g. Organization"
              value={targetType}
              onChange={(e) => { setTargetType(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <Card className="overflow-hidden p-0">
          {!loaded ? (
            <div className="p-4">
              <Skeleton className="h-64" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center">
              <Shield className="mb-3 h-10 w-10 text-text-muted" aria-hidden="true" />
              <p className="text-sm font-medium text-text">No audit logs found</p>
              <p className="text-xs text-text-secondary">Change filters or come back after actions are logged.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Org</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">{new Date(log.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p className="font-medium text-text">{log.platformAdmin?.name ?? log.user?.name ?? "System"}</p>
                          <p className="text-text-muted">{log.platformAdmin?.email ?? log.user?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.targetType && log.targetId ? (
                          <span className="text-xs text-text-secondary">{log.targetType} · {log.targetId.slice(-8)}</span>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.org ? (
                          <span className="text-xs text-text-secondary">{log.org.name}</span>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={resultVariant(log.result)}>{log.result}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-text-muted">{log.ip ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">
              Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
              </Button>
              <span className="text-xs text-text-secondary">Page {page} of {totalPages}</span>
              <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
