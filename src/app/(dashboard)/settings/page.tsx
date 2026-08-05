"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Badge, Button, Card, Input, Select, Textarea, PageHeader, Tabs } from "@/components/ui";
import { VERTICAL_PRESETS } from "@/lib/vertical-presets";
import { RoleAwareAdminGuard } from "../role";

type Tab = "profile" | "telegram" | "email" | "whatsapp" | "instagram" | "voice" | "security";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Business profile" },
  { id: "telegram", label: "Telegram" },
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "voice", label: "Voice" },
  { id: "security", label: "Security" },
];

interface BusinessProfileForm {
  businessName: string;
  industry: string;
  description: string;
  tone: string;
  knowledgeBase: string;
  signOff: string;
}

interface ChannelSummary {
  id: string;
  type: "TELEGRAM" | "EMAIL" | "WHATSAPP" | "INSTAGRAM" | "VOICE";
  isActive: boolean;
  telegramBotUsername: string | null;
  emailAddress: string | null;
  emailFromName: string | null;
  whatsappAppName: string | null;
  whatsappAppId: string | null;
  whatsappSourceNumber: string | null;
  instagramUsername: string | null;
  instagramPageId: string | null;
  twilioFromNumber: string | null;
  voiceLanguage: string | null;
}

export default function SettingsPage() {
  return (
    <RoleAwareAdminGuard>
      <SettingsPageContent />
    </RoleAwareAdminGuard>
  );
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const initialChannel = searchParams.get("channel");
  const initialTab = TABS.find((t) => t.id === initialChannel)?.id ?? "profile";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  // If the user connects a channel before the initial GET resolves, that
  // stale response (fetched before the connection existed) must not be
  // allowed to overwrite the just-connected state when it finally arrives.
  const hasLocalUpdateRef = useRef(false);

  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((d) => {
        if (!hasLocalUpdateRef.current) setChannels(d.channels ?? []);
      });
  }, []);

  function applyLocalUpdate(updater: (prev: ChannelSummary[]) => ChannelSummary[]) {
    hasLocalUpdateRef.current = true;
    setChannels(updater);
  }

  const telegramChannel = channels.find((c) => c.type === "TELEGRAM");
  const emailChannel = channels.find((c) => c.type === "EMAIL");
  const whatsappChannel = channels.find((c) => c.type === "WHATSAPP");
  const instagramChannel = channels.find((c) => c.type === "INSTAGRAM");
  const voiceChannel = channels.find((c) => c.type === "VOICE");

  const tabContent: Record<Tab, React.ReactNode> = {
    profile: <BusinessProfileTab />,
    telegram: (
      <TelegramTab
        channel={telegramChannel}
        onConnected={(c) =>
          applyLocalUpdate((prev) => [...prev.filter((p) => p.type !== "TELEGRAM"), c])
        }
      />
    ),
    email: (
      <EmailTab
        channel={emailChannel}
        onConnected={(c) =>
          applyLocalUpdate((prev) => [...prev.filter((p) => p.type !== "EMAIL"), c])
        }
      />
    ),
    whatsapp: (
      <WhatsAppTab
        channel={whatsappChannel}
        onConnected={(c) =>
          applyLocalUpdate((prev) => [...prev.filter((p) => p.type !== "WHATSAPP"), c])
        }
      />
    ),
    instagram: (
      <InstagramTab
        channel={instagramChannel}
        onConnected={(c) =>
          applyLocalUpdate((prev) => [...prev.filter((p) => p.type !== "INSTAGRAM"), c])
        }
      />
    ),
    voice: (
      <VoiceTab
        channel={voiceChannel}
        onConnected={(c) =>
          applyLocalUpdate((prev) => [...prev.filter((p) => p.type !== "VOICE"), c])
        }
      />
    ),
    security: <SecurityTab />,
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Settings"
        description="Connect channels and tell the AI about your business."
      />

      <div className="px-6">
        <Tabs
          tabs={TABS.map((t) => ({ ...t, content: tabContent[t.id] }))}
          defaultTab={tab}
          onChange={(id) => setTab(id as Tab)}
        />
      </div>
    </div>
  );
}

function ConnectedBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant="success">Connected</Badge>
      <p className="text-sm text-text-secondary">{children}</p>
    </div>
  );
}

function WebhookInfo({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
      {children}
    </div>
  );
}

function BusinessProfileTab() {
  const [form, setForm] = useState<BusinessProfileForm>({
    businessName: "",
    industry: "",
    description: "",
    tone: "friendly and professional",
    knowledgeBase: "",
    signOff: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");

  useEffect(() => {
    fetch("/api/business-profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          setForm({
            businessName: d.profile.businessName ?? "",
            industry: d.profile.industry ?? "",
            description: d.profile.description ?? "",
            tone: d.profile.tone ?? "friendly and professional",
            knowledgeBase: d.profile.knowledgeBase ?? "",
            signOff: d.profile.signOff ?? "",
          });
        }
        setStatus("idle");
      });
  }, []);

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/business-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "loading") return <p className="text-sm text-text-secondary">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        This powers the AI draft-reply engine — the more detail here, the better its replies.
      </p>

      <Card className="flex flex-col gap-2 p-3">
        <p className="text-xs font-medium text-text">Quick start</p>
        <p className="text-xs text-text-secondary">
          Prefill this form with a starting point for your industry — nothing saves until you hit
          Save below, so review and edit before that.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {VERTICAL_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setForm({
                  ...form,
                  industry: preset.businessProfile.industry,
                  description: preset.businessProfile.description,
                  tone: preset.businessProfile.tone,
                  knowledgeBase: preset.businessProfile.knowledgeBase,
                  signOff: preset.businessProfile.signOff,
                })
              }
            >
              Use {preset.label} starter
            </Button>
          ))}
        </div>
      </Card>

      <Input
        label="Business name"
        value={form.businessName}
        onChange={(e) => setForm({ ...form, businessName: e.target.value })}
      />
      <Input
        label="Industry"
        value={form.industry}
        onChange={(e) => setForm({ ...form, industry: e.target.value })}
        placeholder="e.g. Real estate"
      />
      <Textarea
        label="What does your business do?"
        rows={3}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <Input
        label="Reply tone"
        value={form.tone}
        onChange={(e) => setForm({ ...form, tone: e.target.value })}
      />
      <Textarea
        label="Knowledge base (FAQs, pricing, policies)"
        rows={6}
        value={form.knowledgeBase}
        onChange={(e) => setForm({ ...form, knowledgeBase: e.target.value })}
      />
      <Input
        label="Sign-off"
        value={form.signOff}
        onChange={(e) => setForm({ ...form, signOff: e.target.value })}
        placeholder="e.g. — Team EverReach"
      />

      <Button onClick={save} loading={status === "saving"} className="mt-2 w-fit">
        {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Save"}
      </Button>
      {status === "error" && <p className="text-sm text-danger">Failed to save. Try again.</p>}
    </div>
  );
}

function TelegramTab({
  channel,
  onConnected,
}: {
  channel: ChannelSummary | undefined;
  onConnected: (c: ChannelSummary) => void;
}) {
  const [botToken, setBotToken] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setStatus("saving");
    setError(null);
    let res: Response;
    let data;
    try {
      res = await fetch("/api/channels/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken }),
      });
      data = await res.json();
    } catch {
      setStatus("error");
      setError("Network error — check your connection and try again.");
      return;
    }
    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Failed to connect");
      return;
    }
    setStatus("idle");
    setBotToken("");
    onConnected({
      id: data.id,
      type: "TELEGRAM",
      isActive: true,
      telegramBotUsername: data.botUsername,
      emailAddress: null,
      emailFromName: null,
      whatsappAppName: null,
      whatsappAppId: null,
      whatsappSourceNumber: null,
      instagramUsername: null,
      instagramPageId: null,
      twilioFromNumber: null,
      voiceLanguage: null,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Create a bot with{" "}
        <a
          href="https://t.me/BotFather"
          target="_blank"
          rel="noreferrer"
          className="cursor-pointer text-primary hover:text-primary-hover"
        >
          @BotFather
        </a>{" "}
        on Telegram, then paste its token below. Customer messages will start flowing into your
        inbox immediately.
      </p>

      {channel && <ConnectedBanner>@{channel.telegramBotUsername}</ConnectedBanner>}

      <Input
        label="Bot token"
        value={botToken}
        onChange={(e) => setBotToken(e.target.value)}
        placeholder="123456789:AAExampleTokenFromBotFather"
      />

      <Button onClick={connect} loading={status === "saving"} disabled={!botToken} className="w-fit">
        {status === "saving" ? "Connecting..." : channel ? "Reconnect" : "Connect"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function EmailTab({
  channel,
  onConnected,
}: {
  channel: ChannelSummary | undefined;
  onConnected: (c: ChannelSummary) => void;
}) {
  const [emailAddress, setEmailAddress] = useState(channel?.emailAddress ?? "");
  const [emailFromName, setEmailFromName] = useState(channel?.emailFromName ?? "");
  const [resendApiKey, setResendApiKey] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // channel arrives asynchronously (parent's /api/channels fetch) — a plain
  // useState initializer only runs once at mount, so if this tab is opened
  // before that fetch resolves, the fields would otherwise stay blank forever
  // even once the channel data arrives. Sync during render (React's
  // documented pattern for this) rather than in an effect.
  const [prevChannel, setPrevChannel] = useState(channel);
  if (channel !== prevChannel) {
    setPrevChannel(channel);
    if (channel) {
      setEmailAddress(channel.emailAddress ?? "");
      setEmailFromName(channel.emailFromName ?? "");
    }
  }

  async function connect() {
    setStatus("saving");
    setError(null);
    let res: Response;
    let data;
    try {
      res = await fetch("/api/channels/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAddress, emailFromName, resendApiKey: resendApiKey || undefined }),
      });
      data = await res.json();
    } catch {
      setStatus("error");
      setError("Network error — check your connection and try again.");
      return;
    }
    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Failed to save");
      return;
    }
    setStatus("idle");
    onConnected({
      id: data.id,
      type: "EMAIL",
      isActive: true,
      telegramBotUsername: null,
      emailAddress: data.emailAddress,
      emailFromName,
      whatsappAppName: null,
      whatsappAppId: null,
      whatsappSourceNumber: null,
      instagramUsername: null,
      instagramPageId: null,
      twilioFromNumber: null,
      voiceLanguage: null,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        The address customers reply to. Outbound send uses Resend — point your inbound provider&apos;s
        webhook at <code>/api/email/inbound</code>.
      </p>

      {channel && <ConnectedBanner>{channel.emailAddress}</ConnectedBanner>}

      <Input
        label="Support email address"
        value={emailAddress}
        onChange={(e) => setEmailAddress(e.target.value)}
        placeholder="support@yourbusiness.com"
      />
      <Input
        label="Sender name"
        value={emailFromName}
        onChange={(e) => setEmailFromName(e.target.value)}
        placeholder="Your Business Name"
      />
      <Input
        label="Resend API key (optional — falls back to platform key)"
        type="password"
        value={resendApiKey}
        onChange={(e) => setResendApiKey(e.target.value)}
        placeholder="re_..."
      />

      <Button
        onClick={connect}
        loading={status === "saving"}
        disabled={!emailAddress || !emailFromName}
        className="w-fit"
      >
        {status === "saving" ? "Saving..." : channel ? "Update" : "Save"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function WhatsAppTab({
  channel,
  onConnected,
}: {
  channel: ChannelSummary | undefined;
  onConnected: (c: ChannelSummary) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [appName, setAppName] = useState(channel?.whatsappAppName ?? "");
  const [appId, setAppId] = useState(channel?.whatsappAppId ?? "");
  const [sourceNumber, setSourceNumber] = useState(channel?.whatsappSourceNumber ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);

  const [prevChannel, setPrevChannel] = useState(channel);
  if (channel !== prevChannel) {
    setPrevChannel(channel);
    if (channel) {
      setAppName(channel.whatsappAppName ?? "");
      setAppId(channel.whatsappAppId ?? "");
      setSourceNumber(channel.whatsappSourceNumber ?? "");
    }
  }

  async function connect() {
    setStatus("saving");
    setError(null);
    let res: Response;
    let data;
    try {
      res = await fetch("/api/channels/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, appName, appId: appId || undefined, sourceNumber }),
      });
      data = await res.json();
    } catch {
      setStatus("error");
      setError("Network error — check your connection and try again.");
      return;
    }
    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Failed to save");
      return;
    }
    setStatus("idle");
    setApiKey("");
    setWebhookUrl(data.webhookUrl);
    onConnected({
      id: data.id,
      type: "WHATSAPP",
      isActive: true,
      telegramBotUsername: null,
      emailAddress: null,
      emailFromName: null,
      whatsappAppName: appName,
      whatsappAppId: appId || null,
      whatsappSourceNumber: sourceNumber,
      instagramUsername: null,
      instagramPageId: null,
      twilioFromNumber: null,
      voiceLanguage: null,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Requires a{" "}
        <a
          href="https://www.gupshup.io/"
          target="_blank"
          rel="noreferrer"
          className="cursor-pointer text-primary hover:text-primary-hover"
        >
          Gupshup
        </a>{" "}
        WhatsApp Business API app (faster approval path than applying to Meta directly). Paste
        your app&apos;s API key, app name, and registered source number below.
      </p>

      {channel && <ConnectedBanner>{channel.whatsappAppName} ({channel.whatsappSourceNumber})</ConnectedBanner>}

      <Input label="Gupshup API key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      <Input
        label="App name"
        value={appName}
        onChange={(e) => setAppName(e.target.value)}
        placeholder="e.g. SushantRealtyBot"
      />
      <Input
        label="Source number (registered WhatsApp business number)"
        value={sourceNumber}
        onChange={(e) => setSourceNumber(e.target.value)}
        placeholder="919876543210"
      />
      <Input
        label="Gupshup App ID (optional — needed to manage message templates)"
        value={appId}
        onChange={(e) => setAppId(e.target.value)}
        placeholder="e.g. 7a1b2c3d-...."
        hint="Found in your Gupshup dashboard under this app's settings — different from the app name above."
      />

      <Button
        onClick={connect}
        loading={status === "saving"}
        disabled={!apiKey || !appName || !sourceNumber}
        className="w-fit"
      >
        {status === "saving" ? "Saving..." : channel ? "Update" : "Save"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}

      {webhookUrl && (
        <WebhookInfo>
          <p className="mb-1 font-medium text-text">
            Paste this into your Gupshup app&apos;s callback URL setting to receive messages:
          </p>
          <code className="break-all">{webhookUrl}</code>
        </WebhookInfo>
      )}

      {channel && (
        <div className="mt-4 border-t border-border pt-4">
          <WhatsAppTemplates />
        </div>
      )}
    </div>
  );
}

interface WhatsAppTemplateSummary {
  id: string;
  name: string;
  category: "MARKETING" | "UTILITY";
  language: string;
  bodyText: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
}

function templateStatusVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

function WhatsAppTemplates() {
  const [templates, setTemplates] = useState<WhatsAppTemplateSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY">("UTILITY");
  const [bodyText, setBodyText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  function refresh() {
    fetch("/api/whatsapp-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .finally(() => setLoaded(true));
  }

  useEffect(refresh, []);

  async function createTemplate() {
    setStatus("saving");
    setError(null);
    setWarning(null);
    let res: Response;
    let data;
    try {
      res = await fetch("/api/whatsapp-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, bodyText }),
      });
      data = await res.json();
    } catch {
      setStatus("error");
      setError("Network error — check your connection and try again.");
      return;
    }
    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Failed to create template");
      return;
    }
    setStatus("idle");
    setName("");
    setBodyText("");
    if (data.warning) setWarning(data.warning);
    refresh();
  }

  async function syncStatus(id: string) {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/whatsapp-templates/${id}/sync`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Failed to sync template status");
    } catch {
      setError("Network error — check your connection and try again.");
    }
    setSyncingId(null);
    refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-text">Message templates</h3>
        <p className="text-xs text-text-secondary">
          Meta requires an approved template to message a contact who hasn&apos;t written in the last
          24 hours — Campaigns and Reminders use these instead of free text. Submitted templates go
          through Meta review via Gupshup, which can take anywhere from minutes to a couple of days.
        </p>
      </div>

      {loaded && templates.length === 0 && (
        <Card className="flex flex-col gap-2 p-3">
          <p className="text-xs font-medium text-text">Suggested for Real Estate</p>
          <div className="flex flex-col gap-2">
            {VERTICAL_PRESETS.find((p) => p.id === "real-estate")?.whatsappTemplates.map((t) => (
              <div key={t.name} className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-2">
                <div>
                  <p className="font-mono text-xs text-text">{t.name}</p>
                  <p className="text-xs text-text-secondary">{t.description}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setName(t.name);
                    setCategory(t.category);
                    setBodyText(t.bodyText);
                  }}
                >
                  Use this
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loaded && templates.length > 0 && (
        <ul className="flex flex-col gap-2">
          {templates.map((t) => (
            <li key={t.id} className="rounded-md border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-text">{t.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={templateStatusVariant(t.status)}>{t.status}</Badge>
                  {t.status !== "APPROVED" && (
                    <button
                      onClick={() => syncStatus(t.id)}
                      disabled={syncingId === t.id}
                      className="cursor-pointer text-xs text-primary hover:text-primary-hover disabled:opacity-50"
                    >
                      {syncingId === t.id ? "Checking..." : "Check status"}
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-text-secondary">{t.bodyText}</p>
              {t.rejectionReason && <p className="mt-1 text-xs text-danger">{t.rejectionReason}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <Input
          label="Template name"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
          placeholder="appointment_reminder"
          hint="Lowercase, numbers, underscores only — this is fixed once submitted."
        />
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
          <option value="UTILITY">Utility (order/appointment updates)</option>
          <option value="MARKETING">Marketing (promotions, offers)</option>
        </Select>
        <Textarea
          label="Body"
          rows={3}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          placeholder="Hi {{1}}, your appointment is confirmed for tomorrow at 4 PM."
          hint="Must include {{1}} — filled with the contact's name when sent."
        />
        <Button
          onClick={createTemplate}
          loading={status === "saving"}
          disabled={!name || !bodyText}
          className="w-fit"
        >
          {status === "saving" ? "Submitting..." : "Submit for approval"}
        </Button>
        {error && <p className="text-sm text-danger">{error}</p>}
        {warning && (
          <p className="text-xs text-warning">
            Saved locally, but Gupshup didn&apos;t confirm submission: {warning}
          </p>
        )}
      </div>
    </div>
  );
}

function InstagramTab({
  channel,
  onConnected,
}: {
  channel: ChannelSummary | undefined;
  onConnected: (c: ChannelSummary) => void;
}) {
  const [pageAccessToken, setPageAccessToken] = useState("");
  const [pageId, setPageId] = useState(channel?.instagramPageId ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);

  const [prevChannel, setPrevChannel] = useState(channel);
  if (channel !== prevChannel) {
    setPrevChannel(channel);
    if (channel) setPageId(channel.instagramPageId ?? "");
  }

  async function connect() {
    setStatus("saving");
    setError(null);
    let res: Response;
    let data;
    try {
      res = await fetch("/api/channels/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageAccessToken, pageId }),
      });
      data = await res.json();
    } catch {
      setStatus("error");
      setError("Network error — check your connection and try again.");
      return;
    }
    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Failed to save");
      return;
    }
    setStatus("idle");
    setPageAccessToken("");
    setWebhookUrl(data.webhookUrl);
    setVerifyToken(data.verifyToken);
    onConnected({
      id: data.id,
      type: "INSTAGRAM",
      isActive: true,
      telegramBotUsername: null,
      emailAddress: null,
      emailFromName: null,
      whatsappAppName: null,
      whatsappAppId: null,
      whatsappSourceNumber: null,
      instagramUsername: data.username,
      instagramPageId: pageId,
      twilioFromNumber: null,
      voiceLanguage: null,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Requires a{" "}
        <a
          href="https://developers.facebook.com/docs/messenger-platform/instagram"
          target="_blank"
          rel="noreferrer"
          className="cursor-pointer text-primary hover:text-primary-hover"
        >
          Meta App
        </a>{" "}
        with Instagram Messaging enabled (app review required) and a Facebook Page linked to your
        Instagram professional account.
      </p>

      {channel && <ConnectedBanner>{channel.instagramUsername}</ConnectedBanner>}

      <Input
        label="Page access token"
        type="password"
        value={pageAccessToken}
        onChange={(e) => setPageAccessToken(e.target.value)}
      />
      <Input
        label="Facebook Page ID"
        value={pageId}
        onChange={(e) => setPageId(e.target.value)}
        placeholder="1234567890"
      />

      <Button
        onClick={connect}
        loading={status === "saving"}
        disabled={!pageAccessToken || !pageId}
        className="w-fit"
      >
        {status === "saving" ? "Saving..." : channel ? "Update" : "Save"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}

      {webhookUrl && (
        <WebhookInfo>
          <p className="mb-1 font-medium text-text">
            In your Meta App&apos;s Webhooks product, subscribe to Instagram with:
          </p>
          <p className="mb-1">
            <span className="text-text-secondary">Callback URL: </span>
            <code className="break-all">{webhookUrl}</code>
          </p>
          <p>
            <span className="text-text-secondary">Verify token: </span>
            <code className="break-all">{verifyToken}</code>
          </p>
        </WebhookInfo>
      )}
    </div>
  );
}

function VoiceTab({
  channel,
  onConnected,
}: {
  channel: ChannelSummary | undefined;
  onConnected: (c: ChannelSummary) => void;
}) {
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [fromNumber, setFromNumber] = useState(channel?.twilioFromNumber ?? "");
  const [language, setLanguage] = useState(channel?.voiceLanguage ?? "en-IN");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const [prevChannel, setPrevChannel] = useState(channel);
  if (channel !== prevChannel) {
    setPrevChannel(channel);
    if (channel) {
      setFromNumber(channel.twilioFromNumber ?? "");
      setLanguage(channel.voiceLanguage ?? "en-IN");
    }
  }

  async function connect() {
    setStatus("saving");
    setError(null);
    let res: Response;
    let data;
    try {
      res = await fetch("/api/channels/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountSid, authToken, fromNumber, language }),
      });
      data = await res.json();
    } catch {
      setStatus("error");
      setError("Network error — check your connection and try again.");
      return;
    }
    if (!res.ok) {
      setStatus("error");
      setError(data.error ?? "Failed to save");
      return;
    }
    setStatus("idle");
    setAuthToken("");
    onConnected({
      id: data.id,
      type: "VOICE",
      isActive: true,
      telegramBotUsername: null,
      emailAddress: null,
      emailFromName: null,
      whatsappAppName: null,
      whatsappAppId: null,
      whatsappSourceNumber: null,
      instagramUsername: null,
      instagramPageId: null,
      twilioFromNumber: fromNumber,
      voiceLanguage: language,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-warning bg-warning-light px-3 py-2.5 text-sm text-text">
        <p className="font-medium">Reminder calls only — not for bulk or cold calling.</p>
        <p className="mt-1 text-xs text-text-secondary">
          India&apos;s TRAI/DND rules restrict unsolicited automated calling. Voice in EverReach is
          wired only into individually-scheduled Reminders to contacts already in your system — it
          is intentionally not available as a bulk Campaign channel. Confirm your own compliance
          obligations (consent, DND registry, calling hours) before using this with real customers.
        </p>
      </div>

      <p className="text-sm text-text-secondary">
        Requires a{" "}
        <a
          href="https://www.twilio.com/console"
          target="_blank"
          rel="noreferrer"
          className="cursor-pointer text-primary hover:text-primary-hover"
        >
          Twilio
        </a>{" "}
        account with a voice-capable phone number.
      </p>

      {channel && <ConnectedBanner>{channel.twilioFromNumber}</ConnectedBanner>}

      <Input
        label="Account SID"
        value={accountSid}
        onChange={(e) => setAccountSid(e.target.value)}
        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      />
      <Input label="Auth token" type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} />
      <Input
        label="From number (your Twilio voice number)"
        value={fromNumber}
        onChange={(e) => setFromNumber(e.target.value)}
        placeholder="+15551234567"
      />
      <Select label="Call language" value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option value="en-IN">English (India)</option>
        <option value="hi-IN">Hindi</option>
        <option value="en-US">English (US)</option>
      </Select>

      <Button
        onClick={connect}
        loading={status === "saving"}
        disabled={!accountSid || !authToken || !fromNumber}
        className="w-fit"
      >
        {status === "saving" ? "Saving..." : channel ? "Update" : "Save"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}


function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaStatus, setMfaStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableStatus, setDisableStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [disableError, setDisableError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/mfa').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.enabled) setMfaEnabled(true);
    });
  }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
    setPasswordStatus('saving');
    const res = await fetch('/api/users/me/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setPasswordStatus(res.ok ? 'saved' : 'error');
    if (!res.ok) setPasswordError(data.error ?? 'Failed to update password');
    if (res.ok) { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
  }

  async function startMfaSetup() {
    setMfaStatus('idle'); setMfaError(null); setBackupCodes(null);
    const res = await fetch('/api/auth/mfa', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMfaError(data.error ?? 'Failed'); return; }
    setQrUri(data.uri);
  }

  async function verifyMfaSetup(e: React.FormEvent) {
    e.preventDefault();
    setMfaError(null); setMfaStatus('saving');
    const res = await fetch('/api/auth/mfa', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: mfaCode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMfaStatus('error'); setMfaError(data.error ?? 'Invalid code'); return; }
    setMfaStatus('saved');
    setMfaEnabled(true);
    setBackupCodes(data.backupCodes ?? []);
    setQrUri(null);
  }

  async function disableMfa(e: React.FormEvent) {
    e.preventDefault();
    setDisableError(null);
    setDisableStatus('saving');
    const res = await fetch('/api/auth/mfa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: disablePassword }),
    });
    const data = await res.json().catch(() => ({}));
    setDisableStatus(res.ok ? 'saved' : 'error');
    if (!res.ok) setDisableError(data.error ?? 'Failed to disable MFA');
    if (res.ok) { setMfaEnabled(false); setDisablePassword(''); }
  }

  return (
    <div className='flex flex-col gap-6'>
      <section className='flex flex-col gap-4'>
        <h3 className='text-sm font-medium text-text'>Change password</h3>
        <form onSubmit={changePassword} className='flex flex-col gap-4'>
          <Input label='Current password' type='password' required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          <Input label='New password' type='password' required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <Input label='Confirm new password' type='password' required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          {passwordError && <p className='text-sm text-danger'>{passwordError}</p>}
          <Button type='submit' loading={passwordStatus === 'saving'} className='w-fit'>{passwordStatus === 'saved' ? 'Updated' : 'Update password'}</Button>
        </form>
      </section>

      <section className='flex flex-col gap-4 border-t border-border pt-4'>
        <h3 className='text-sm font-medium text-text'>Two-factor authentication</h3>
        {mfaEnabled ? (
          <form onSubmit={disableMfa} className='flex flex-col gap-4'>
            <p className='text-sm text-text-secondary'>MFA is enabled. Enter your current password to disable it.</p>
            <Input label='Current password' type='password' required value={disablePassword} onChange={e => setDisablePassword(e.target.value)} />
            {disableError && <p className='text-sm text-danger'>{disableError}</p>}
            <Button type='submit' loading={disableStatus === 'saving'} variant='danger' className='w-fit'>Disable MFA</Button>
          </form>
        ) : (
          <>
            {!qrUri && <Button onClick={startMfaSetup} className='w-fit'>Set up MFA</Button>}
            {qrUri && (
              <form onSubmit={verifyMfaSetup} className='flex flex-col gap-4'>
                <p className='text-sm text-text-secondary'>Scan this QR code with your authenticator app, then enter the 6-digit code.</p>
                <div className='rounded-md border border-border bg-white p-3 w-fit'>
                  <QRCodeSVG value={qrUri} size={160} />
                </div>
                <Input label='Authentication code' inputMode='numeric' required value={mfaCode} onChange={e => setMfaCode(e.target.value)} />
                {mfaError && <p className='text-sm text-danger'>{mfaError}</p>}
                <Button type='submit' loading={mfaStatus === 'saving'} className='w-fit'>Verify and enable MFA</Button>
              </form>
            )}
            {backupCodes && (
              <div className='rounded-md border border-success bg-success/10 p-3'>
                <p className='text-sm font-medium text-text'>MFA enabled. Save these backup codes — they let you log in if you lose your authenticator.</p>
                <ul className='mt-2 font-mono text-xs text-text-secondary space-y-1'>
                  {backupCodes.map(c => <li key={c}>{c.match(/.{3}/g)?.join(' ')}</li>)}
                </ul>
              </div>
            )}
          </>)}
      </section>
    </div>
  );
}

