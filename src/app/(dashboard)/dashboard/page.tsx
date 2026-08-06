import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Megaphone,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgId } from "@/lib/session";
import { Button, Card, PageHeader, StatCard, Badge } from "@/components/ui";
import { contactLabel } from "@/lib/contact-label";

function channelLabel(type: string) {
  if (type === "TELEGRAM") return "Telegram";
  if (type === "EMAIL") return "Email";
  if (type === "WHATSAPP") return "WhatsApp";
  if (type === "INSTAGRAM") return "Instagram";
  return "Voice";
}

function startOfDay(d = new Date()) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(d = new Date()) {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId = await requireOrgId();

  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const tomorrowEnd = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000);

  const [
    conversationsToday,
    openConversations,
    contactsCount,
    messagesSentToday,
    activeCampaigns,
    upcomingReminders,
    failedCampaigns,
    failedReminders,
    pendingTemplates,
    wallet,
    channels,
    recentConversations,
    todaysReminders,
    latestCampaigns,
  ] = await Promise.all([
    prisma.conversation.count({
      where: { orgId, lastMessageAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.conversation.count({ where: { orgId, status: "OPEN" } }),
    prisma.contact.count({ where: { orgId } }),
    prisma.message.count({
      where: {
        conversation: { orgId },
        direction: "OUTBOUND",
        isAiDraft: false,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.campaign.count({
      where: { orgId, status: { in: ["QUEUED", "SENDING"] } },
    }),
    prisma.reminder.count({
      where: { orgId, status: "PENDING", scheduledFor: { gte: todayStart, lte: tomorrowEnd } },
    }),
    prisma.campaign.count({
      where: { orgId, status: "FAILED" },
    }),
    prisma.reminder.count({
      where: { orgId, status: "FAILED" },
    }),
    prisma.whatsAppTemplate.count({
      where: {
        channel: { orgId },
        status: { in: ["PENDING", "REJECTED"] },
      },
    }),
    prisma.whatsAppWallet.findUnique({ where: { orgId } }),
    prisma.channel.findMany({
      where: { orgId },
      select: { type: true, isActive: true, telegramBotUsername: true, emailAddress: true, whatsappAppName: true, instagramUsername: true, twilioFromNumber: true },
    }),
    prisma.conversation.findMany({
      where: { orgId },
      orderBy: { lastMessageAt: "desc" },
      take: 8,
      include: {
        contact: true,
        channel: { select: { type: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.reminder.findMany({
      where: { orgId, status: "PENDING", scheduledFor: { gte: todayStart, lte: todayEnd } },
      orderBy: { scheduledFor: "asc" },
      take: 5,
      include: { contact: true, channel: { select: { type: true } } },
    }),
    prisma.campaign.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { channel: { select: { type: true } } },
    }),
  ]);

  const lowBalance = wallet ? wallet.balancePaise <= wallet.lowBalanceThresholdPaise : false;
  const attentionItems = [
    ...(openConversations > 0 ? [{ label: "Open conversations", value: openConversations, href: "/inbox" }] : []),
    ...(failedCampaigns > 0 ? [{ label: "Failed campaigns", value: failedCampaigns, href: "/campaigns" }] : []),
    ...(failedReminders > 0 ? [{ label: "Failed reminders", value: failedReminders, href: "/reminders" }] : []),
    ...(pendingTemplates > 0 ? [{ label: "Templates pending/rejected", value: pendingTemplates, href: "/channels" }] : []),
    ...(lowBalance ? [{ label: "Low WhatsApp balance", value: "Top up", href: "/billing" }] : []),
  ];

  const disconnectedChannels = ["TELEGRAM", "EMAIL", "WHATSAPP", "INSTAGRAM", "VOICE"].filter(
    (type) => !channels.some((c) => c.type === type && c.isActive)
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title={`Good ${greeting()}, ${session.user.name}`}
        description={`${session.user.orgName} · ${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`}
      />

      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Conversations today" value={String(conversationsToday)} />
          <StatCard label="Open conversations" value={String(openConversations)} />
          <StatCard label="Contacts" value={String(contactsCount)} />
          <StatCard label="Messages sent today" value={String(messagesSentToday)} />
          <StatCard label="Active campaigns" value={String(activeCampaigns)} />
          <StatCard label="Reminders today" value={String(upcomingReminders)} />
        </div>

        {/* Attention required */}
        {attentionItems.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-text">Attention required</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {attentionItems.map((item) => (
                <Link key={item.label} href={item.href}>
                  <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-hover">
                    <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-text-secondary">{item.label}</p>
                      <p className="text-lg font-bold text-text">{item.value}</p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent conversations */}
          <Card className="col-span-2 flex flex-col p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text">Recent conversations</h2>
              </div>
              <Link href="/inbox">
                <Button variant="secondary" size="sm">View all</Button>
              </Link>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {recentConversations.length === 0 ? (
                <p className="px-5 py-6 text-sm text-text-secondary">No conversations yet — connect a channel to start receiving messages.</p>
              ) : (
                recentConversations.map((c) => {
                  const last = c.messages[0];
                  return (
                    <Link key={c.id} href={`/inbox/${c.id}`} className="flex cursor-pointer items-center justify-between px-5 py-3 transition-colors hover:bg-hover">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text">{contactLabel(c.contact)}</p>
                        <p className="truncate text-xs text-text-secondary">
                          {last ? (last.isAiDraft ? "AI draft ready — " : "") + last.body : "No messages"}
                        </p>
                      </div>
                      <Badge>{channelLabel(c.channel.type)}</Badge>
                    </Link>
                  );
                })
              )}
            </div>
          </Card>

          {/* Upcoming reminders */}
          <Card className="flex flex-col p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text">Today&apos;s reminders</h2>
              </div>
              <Link href="/reminders">
                <Button variant="ghost" size="sm">All</Button>
              </Link>
            </div>
            <div className="flex flex-1 flex-col divide-y divide-border">
              {todaysReminders.length === 0 ? (
                <p className="flex-1 px-5 py-6 text-sm text-text-secondary">No reminders scheduled for today.</p>
              ) : (
                todaysReminders.map((r) => (
                  <div key={r.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-text">{contactLabel(r.contact)}</p>
                    <p className="text-xs text-text-secondary">{r.channel.type} · {new Date(r.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    <p className="truncate text-xs text-text-muted">{r.message}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Campaign performance */}
          <Card className="col-span-2 flex flex-col p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text">Latest campaigns</h2>
              </div>
              <Link href="/campaigns">
                <Button variant="secondary" size="sm">View all</Button>
              </Link>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {latestCampaigns.length === 0 ? (
                <p className="px-5 py-6 text-sm text-text-secondary">No campaigns yet.</p>
              ) : (
                latestCampaigns.map((c) => (
                  <Link key={c.id} href={`/campaigns/${c.id}`} className="flex cursor-pointer items-center justify-between px-5 py-3 transition-colors hover:bg-hover">
                    <div>
                      <p className="text-sm font-medium text-text">{c.name}</p>
                      <p className="text-xs text-text-secondary">{c.channel.type} · {c.totalRecipients} recipients</p>
                    </div>
                    <div className="text-right">
                      <Badge>{c.status}</Badge>
                      <p className="text-xs text-text-muted">{c.sentCount} sent · {c.failedCount} failed</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>

          {/* Channel health */}
          <Card className="flex flex-col p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text">Channel health</h2>
              </div>
              <Link href="/channels">
                <Button variant="ghost" size="sm">Manage</Button>
              </Link>
            </div>
            <div className="flex flex-1 flex-col divide-y divide-border">
              {(["WhatsApp", "Instagram", "Telegram", "Email", "Voice"] as const).map((name) => {
                const type = name.toUpperCase();
                const channel = channels.find((c) => c.type === type);
                const connected = Boolean(channel?.isActive);
                const detail = channel
                  ? channel.telegramBotUsername ??
                    channel.emailAddress ??
                    channel.whatsappAppName ??
                    channel.instagramUsername ??
                    channel.twilioFromNumber ??
                    "Connected"
                  : null;
                return (
                  <div key={name} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-text">{name}</p>
                      <p className="text-xs text-text-secondary">{detail ?? "Not connected"}</p>
                    </div>
                    {connected ? (
                      <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {disconnectedChannels.length > 0 && (
          <Card className="flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-start">
            <div>
              <p className="text-sm font-medium text-text">Connect more channels</p>
              <p className="text-xs text-text-secondary">
                You haven&apos;t connected {disconnectedChannels.map(channelLabel).join(", ")} yet.
              </p>
            </div>
            <Link href="/channels">
              <Button size="sm">Connect channels</Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
