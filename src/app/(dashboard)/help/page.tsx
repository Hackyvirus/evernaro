import { Card, PageHeader } from "@/components/ui";
import { Mail, MessageCircle, BookOpen } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Help & Support"
        description="Get help with EverReach — documentation, guides, and direct support."
      />
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary-light">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <h2 className="mb-1 text-sm font-semibold text-text">Documentation</h2>
          <p className="text-sm text-text-secondary">
            Step-by-step guides for channels, campaigns, reminders, and billing are coming soon.
          </p>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary-light">
            <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <h2 className="mb-1 text-sm font-semibold text-text">Email support</h2>
          <p className="text-sm text-text-secondary">
            Reach us at{" "}
            <a href="mailto:hello@eversitytech.com" className="text-primary hover:underline">
              hello@eversitytech.com
            </a>{" "}
            for account or billing questions.
          </p>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary-light">
            <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <h2 className="mb-1 text-sm font-semibold text-text">Chat with us</h2>
          <p className="text-sm text-text-secondary">
            Live chat support is coming soon. For urgent issues, email us with &ldquo;Urgent&rdquo; in the subject.
          </p>
        </Card>
      </div>
    </div>
  );
}
