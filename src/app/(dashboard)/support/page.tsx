import { Card, PageHeader, Button } from "@/components/ui";
import { Mail, MessageCircle, BookOpen, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="Help & Support"
        description="Get help with Evernaro — documentation, guides, and direct support."
      />
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary-light">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <h2 className="mb-1 text-sm font-semibold text-text">Documentation</h2>
          <p className="text-sm text-text-secondary">
            Visit the Evernaro Help Center for step-by-step guides on setup, channels, appointments, AI, billing, and
            troubleshooting.
          </p>
          <Link href="/help" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block">
            <Button size="sm" variant="secondary">
              Open Help Center
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </Link>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary-light">
            <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <h2 className="mb-1 text-sm font-semibold text-text">Email support</h2>
          <p className="text-sm text-text-secondary">
            Reach us at{" "}
            <a href="mailto:support@evernaro.com" className="text-primary hover:underline">
              support@evernaro.com
            </a>{" "}
            for account, billing, or setup questions. We typically reply within one business day.
          </p>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary-light">
            <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <h2 className="mb-1 text-sm font-semibold text-text">Priority support</h2>
          <p className="text-sm text-text-secondary">
            For urgent issues, email us with &ldquo;Urgent&rdquo; in the subject and we&apos;ll jump on it as
            soon as possible.
          </p>
        </Card>
      </div>
    </div>
  );
}
