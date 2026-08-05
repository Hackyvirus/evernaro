"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle, Users, Tag, Eye, Send, Clock, AlertCircle } from "lucide-react";
import { Button, Card, Input, PageHeader, Select, Textarea, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { contactLabel } from "@/lib/contact-label";
import { RoleAwareAgentGuard } from "../../role";

interface ChannelOption {
  id: string;
  type: "TELEGRAM" | "EMAIL" | "WHATSAPP" | "INSTAGRAM" | "VOICE";
  telegramBotUsername: string | null;
  emailAddress: string | null;
  whatsappSourceNumber: string | null;
  instagramUsername: string | null;
}

interface WhatsAppTemplateOption {
  id: string;
  name: string;
  bodyText: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface ContactOption {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  telegramChatId: string | null;
  instagramUserId: string | null;
  tags: string[];
}

function channelLabel(c: ChannelOption) {
  if (c.type === "TELEGRAM") return `Telegram${c.telegramBotUsername ? ` · @${c.telegramBotUsername}` : ""}`;
  if (c.type === "EMAIL") return `Email${c.emailAddress ? ` · ${c.emailAddress}` : ""}`;
  if (c.type === "WHATSAPP") return `WhatsApp${c.whatsappSourceNumber ? ` · ${c.whatsappSourceNumber}` : ""}`;
  return `Instagram${c.instagramUsername ? ` · @${c.instagramUsername}` : ""}`;
}

function identifierForChannel(type: ChannelOption["type"]) {
  if (type === "TELEGRAM") return "telegramChatId";
  if (type === "EMAIL") return "email";
  if (type === "WHATSAPP") return "phone";
  if (type === "INSTAGRAM") return "instagramUserId";
  return null;
}

const STEPS = ["Details", "Audience", "Message", "Schedule", "Review", "Result"];

export default function NewCampaignPage() {
  return (
    <RoleAwareAgentGuard>
      <NewCampaignPageContent />
    </RoleAwareAgentGuard>
  );
}

function NewCampaignPageContent() {
  const { showToast } = useToast();
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplateOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [channelId, setChannelId] = useState("");
  const [audience, setAudience] = useState<"all" | "tag" | "selected">("all");
  const [audienceTag, setAudienceTag] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [whatsappTemplateId, setWhatsappTemplateId] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ id: string; totalRecipients: number; status: string } | null>(null);

  const selectedChannel = channels.find((c) => c.id === channelId);
  const isWhatsApp = selectedChannel?.type === "WHATSAPP";
  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/channels").then((r) => r.json()),
      fetch("/api/whatsapp-templates").then((r) => r.json()),
      fetch("/api/contacts").then((r) => r.json()),
    ]).then(([c, t, ct]) => {
      if (!active) return;
      setChannels(c.channels ?? []);
      setTemplates(t.templates ?? []);
      setContacts(ct.contacts ?? []);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const reachableContacts = useMemo(() => {
    if (!selectedChannel) return [];
    const field = identifierForChannel(selectedChannel.type);
    if (!field) return [];
    return contacts.filter((c) => c[field as keyof ContactOption]);
  }, [contacts, selectedChannel]);

  const targetContacts = useMemo(() => {
    if (audience === "all") return reachableContacts;
    if (audience === "tag") return reachableContacts.filter((c) => c.tags.includes(audienceTag));
    return reachableContacts.filter((c) => selectedContactIds.includes(c.id));
  }, [reachableContacts, audience, audienceTag, selectedContactIds]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    reachableContacts.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [reachableContacts]);

  const scheduledAt = useMemo(() => {
    if (scheduleMode === "now" || !scheduledDate || !scheduledTime) return null;
    return new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
  }, [scheduleMode, scheduledDate, scheduledTime]);

  const previewMessage = useMemo(() => {
    if (isWhatsApp) {
      return approvedTemplates.find((t) => t.id === whatsappTemplateId)?.bodyText ?? "";
    }
    return messageTemplate.replace(/\{\{name\}\}/g, "Customer");
  }, [isWhatsApp, messageTemplate, whatsappTemplateId, approvedTemplates]);

  function canProceed() {
    if (step === 0) return Boolean(name && channelId);
    if (step === 1) {
      if (audience === "tag") return Boolean(audienceTag);
      if (audience === "selected") return selectedContactIds.length > 0;
      return true;
    }
    if (step === 2) return isWhatsApp ? Boolean(whatsappTemplateId) : Boolean(messageTemplate.trim());
    if (step === 3) return scheduleMode === "now" || Boolean(scheduledAt);
    return true;
  }

  async function submit() {
    setSaving(true);
    const chosenTemplate = approvedTemplates.find((t) => t.id === whatsappTemplateId);
    const finalMessage = isWhatsApp && chosenTemplate ? chosenTemplate.bodyText : messageTemplate;
    const body: Record<string, unknown> = {
      name,
      description,
      channelId,
      messageTemplate: finalMessage,
      whatsappTemplateId: isWhatsApp ? whatsappTemplateId : undefined,
      timezone,
    };
    if (scheduledAt) body.scheduledAt = scheduledAt;
    if (audience === "tag" && audienceTag) body.audience = { tag: audienceTag };
    else if (audience === "selected") body.audience = { contactIds: selectedContactIds };
    else body.audience = "all";

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to create campaign");
        setSaving(false);
        return;
      }
      setResult({ id: data.campaign.id, totalRecipients: data.campaign.totalRecipients, status: data.campaign.status });
      setStep(5);
      showToast("success", "Campaign created", `${data.campaign.totalRecipients} recipients`);
    } catch {
      showToast("error", "Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader title="New campaign" description="Loading..." />
        <div className="p-6">
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader title="New campaign" description="Build and send a campaign in six steps." backHref="/campaigns" />

      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-6">
          <div className="mb-6 flex items-center justify-between">
            {STEPS.map((label, idx) => (
              <div key={label} className="flex flex-1 items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                    idx <= step ? "bg-primary text-white" : "bg-surface text-text-muted"
                  }`}
                >
                  {idx < step ? <CheckCircle className="h-4 w-4" aria-hidden="true" /> : idx + 1}
                </div>
                <span className={`ml-2 hidden text-xs sm:inline ${idx <= step ? "text-text" : "text-text-muted"}`}>{label}</span>
                {idx < STEPS.length - 1 && <div className="mx-2 hidden h-px flex-1 bg-border sm:block" />}
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <Input label="Campaign name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. August property alerts" />
              <Textarea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              <Select label="Channel" value={channelId} onChange={(e) => { setChannelId(e.target.value); setWhatsappTemplateId(""); }}>
                <option value="">Select channel...</option>
                {channels.filter((c) => c.type !== "VOICE").map((c) => (
                  <option key={c.id} value={c.id}>{channelLabel(c)}</option>
                ))}
              </Select>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button type="button" onClick={() => setAudience("all")} className={`rounded-md border p-4 text-sm transition-colors ${audience === "all" ? "border-primary bg-primary/5 text-text" : "border-border text-text-secondary hover:bg-hover"}`}>
                  <Users className="mx-auto mb-1 h-5 w-5" aria-hidden="true" />
                  All reachable
                </button>
                <button type="button" onClick={() => setAudience("tag")} className={`rounded-md border p-4 text-sm transition-colors ${audience === "tag" ? "border-primary bg-primary/5 text-text" : "border-border text-text-secondary hover:bg-hover"}`}>
                  <Tag className="mx-auto mb-1 h-5 w-5" aria-hidden="true" />
                  Filter by tag
                </button>
                <button type="button" onClick={() => setAudience("selected")} className={`rounded-md border p-4 text-sm transition-colors ${audience === "selected" ? "border-primary bg-primary/5 text-text" : "border-border text-text-secondary hover:bg-hover"}`}>
                  <Eye className="mx-auto mb-1 h-5 w-5" aria-hidden="true" />
                  Select contacts
                </button>
              </div>
              {audience === "tag" && (
                <Select label="Tag" value={audienceTag} onChange={(e) => setAudienceTag(e.target.value)}>
                  <option value="">Select tag...</option>
                  {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              )}
              {audience === "selected" && (
                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                  {reachableContacts.length === 0 ? <p className="p-3 text-sm text-text-secondary">No reachable contacts.</p> : (
                    <ul className="divide-y divide-border">
                      {reachableContacts.map((c) => (
                        <li key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-hover">
                          <input
                            type="checkbox"
                            id={`contact-${c.id}`}
                            checked={selectedContactIds.includes(c.id)}
                            onChange={(e) => setSelectedContactIds((prev) => e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id))}
                            className="h-4 w-4 rounded border-border text-primary"
                          />
                          <label htmlFor={`contact-${c.id}`} className="flex-1 cursor-pointer text-sm text-text">{contactLabel(c)}</label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="rounded-md bg-surface p-3 text-sm text-text-secondary">
                Estimated audience: <span className="font-medium text-text">{targetContacts.length}</span> contacts
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {isWhatsApp ? (
                <Select label="WhatsApp template" value={whatsappTemplateId} onChange={(e) => setWhatsappTemplateId(e.target.value)}>
                  <option value="">Select approved template...</option>
                  {approvedTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              ) : (
                <Textarea label="Message" value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)} rows={6} placeholder="Hi {{name}}, ..." />
              )}
              <div className="rounded-md border border-border bg-surface p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-text-muted">Preview</p>
                <p className="whitespace-pre-wrap text-text">{previewMessage || "Your message will appear here"}</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setScheduleMode("now")} className={`flex flex-col items-center gap-2 rounded-md border p-4 text-sm transition-colors ${scheduleMode === "now" ? "border-primary bg-primary/5 text-text" : "border-border text-text-secondary hover:bg-hover"}`}>
                  <Send className="h-5 w-5" aria-hidden="true" />
                  Send now
                </button>
                <button type="button" onClick={() => setScheduleMode("later")} className={`flex flex-col items-center gap-2 rounded-md border p-4 text-sm transition-colors ${scheduleMode === "later" ? "border-primary bg-primary/5 text-text" : "border-border text-text-secondary hover:bg-hover"}`}>
                  <Clock className="h-5 w-5" aria-hidden="true" />
                  Schedule
                </button>
              </div>
              {scheduleMode === "later" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Input label="Date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                  <Input label="Time" type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                  <Select label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                    <option value="UTC">UTC</option>
                  </Select>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-surface p-4 text-sm space-y-2">
                <p><span className="text-text-muted">Name:</span> <span className="font-medium text-text">{name}</span></p>
                <p><span className="text-text-muted">Channel:</span> <span className="font-medium text-text">{selectedChannel ? channelLabel(selectedChannel) : "—"}</span></p>
                <p><span className="text-text-muted">Audience:</span> <span className="font-medium text-text">{audience === "all" ? "All reachable" : audience === "tag" ? `Tag: ${audienceTag}` : `${selectedContactIds.length} selected`}</span></p>
                <p><span className="text-text-muted">Recipients:</span> <span className="font-medium text-text">{targetContacts.length}</span></p>
                <p><span className="text-text-muted">Schedule:</span> <span className="font-medium text-text">{scheduleMode === "now" ? "Send immediately" : new Date(scheduledAt ?? "").toLocaleString()}</span></p>
                <p><span className="text-text-muted">Message:</span></p>
                <p className="whitespace-pre-wrap rounded-md bg-card p-2 text-text">{previewMessage}</p>
              </div>
              {isWhatsApp && !whatsappTemplateId && (
                <div className="flex items-start gap-2 rounded-md border border-warning bg-warning-light p-3 text-sm text-text">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-warning" aria-hidden="true" />
                  WhatsApp campaigns outside the 24-hour window require an approved template.
                </div>
              )}
            </div>
          )}

          {step === 5 && result && (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
              <h2 className="text-xl font-bold text-text">Campaign {result.status === "SCHEDULED" ? "scheduled" : "created"}</h2>
              <p className="text-text-secondary">{result.totalRecipients} recipients {result.status === "SCHEDULED" ? "queued to send at the scheduled time." : "are being processed."}</p>
              <div className="flex justify-center gap-3">
                <Link href="/campaigns">
                  <Button variant="secondary">Back to campaigns</Button>
                </Link>
                <Link href={`/campaigns/${result.id}`}>
                  <Button>View report</Button>
                </Link>
              </div>
            </div>
          )}

          {step < 5 && (
            <div className="mt-6 flex items-center justify-between">
              <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" /> Back
              </Button>
              {step < STEPS.length - 2 ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
                  Next <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button onClick={submit} loading={saving} disabled={!canProceed() || targetContacts.length === 0}>
                  <Send className="mr-1.5 h-4 w-4" aria-hidden="true" /> {scheduleMode === "now" ? "Send now" : "Schedule"}
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
