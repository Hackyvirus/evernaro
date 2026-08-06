"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Mail,
  Send,
  Camera,
  PhoneCall,
  ArrowRight,
} from "lucide-react";
import { Button, Card, PageHeader, Badge, SkeletonCard } from "@/components/ui";
import { useRole, isAdmin } from "../role";

interface ChannelSummary {
  id: string;
  type: "TELEGRAM" | "EMAIL" | "WHATSAPP" | "INSTAGRAM" | "VOICE";
  isActive: boolean;
  telegramBotUsername: string | null;
  emailAddress: string | null;
  emailFromName: string | null;
  whatsappAppName: string | null;
  whatsappSourceNumber: string | null;
  instagramUsername: string | null;
  twilioFromNumber: string | null;
  voiceLanguage: string | null;
}

const CHANNELS = [
  {
    type: "WHATSAPP" as const,
    name: "WhatsApp",
    description: "Send messages and reminders through your WhatsApp Business API.",
    icon: Send,
  },
  {
    type: "INSTAGRAM" as const,
    name: "Instagram",
    description: "Reply to Instagram DMs from your unified inbox.",
    icon: Camera,
  },
  {
    type: "TELEGRAM" as const,
    name: "Telegram",
    description: "Connect a Telegram bot to receive and reply to messages.",
    icon: MessageSquare,
  },
  {
    type: "EMAIL" as const,
    name: "Email",
    description: "Send and receive emails from a connected address.",
    icon: Mail,
  },
  {
    type: "VOICE" as const,
    name: "Voice",
    description: "Schedule individual voice reminder calls via Twilio.",
    icon: PhoneCall,
  },
];

function channelDetail(channel: ChannelSummary | undefined): string | null {
  if (!channel?.isActive) return null;
  return (
    channel.telegramBotUsername ??
    channel.emailAddress ??
    channel.whatsappAppName ??
    channel.instagramUsername ??
    channel.twilioFromNumber ??
    "Connected"
  );
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const role = useRole();

  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((d) => setChannels(d.channels ?? []))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Channels"
        description="Connect the channels your customers already use."
      />

      <div className="flex flex-1 flex-col gap-6 p-6">
        {!loaded ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHANNELS.map((meta) => {
              const Icon = meta.icon;
              const channel = channels.find((c) => c.type === meta.type);
              const connected = channel?.isActive ?? false;
              const detail = channelDetail(channel);

              return (
                <Card key={meta.type} className="flex flex-col gap-4 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-lighter">
                      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <Badge variant={connected ? "success" : "warning"}>
                      {connected ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-text">{meta.name}</h3>
                    <p className="mt-1 text-sm text-text-secondary">{meta.description}</p>
                    {detail && <p className="mt-2 text-xs text-text-muted">{detail}</p>}
                  </div>
                  {isAdmin(role) && (
                    <Link href={`/settings?channel=${meta.type.toLowerCase()}`}>
                      <Button variant="secondary" size="sm" className="w-full">
                        {connected ? "Manage" : "Connect"}
                        <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </Link>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {isAdmin(role) && (
          <Card className="flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-start">
            <div>
              <p className="text-sm font-medium text-text">Need help connecting a channel?</p>
              <p className="text-xs text-text-secondary">
                Detailed setup instructions are available in Settings for each channel.
              </p>
            </div>
            <Link href="/settings">
              <Button variant="secondary" size="sm">Open Settings</Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
