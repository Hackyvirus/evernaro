import Link from "next/link";

export const metadata = { title: "Privacy Policy — Evernaro" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 text-sm leading-relaxed text-text">
      <Link href="/" className="text-primary hover:text-primary-hover">
        ← Evernaro
      </Link>

      <h1 className="mt-6 text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-1 text-text-secondary">Last updated: 2 August 2026</p>

      <div className="mt-8 flex flex-col gap-6">
        <section>
          <h2 className="text-base font-semibold">1. What we collect</h2>
          <p className="mt-2 text-text-secondary">
            When your business signs up: your business name, your name, email, and a hashed password
            (we never store passwords in plain text). When your customers message you through a
            connected channel: their name, phone number, email address, or channel-specific ID
            (Telegram chat ID, Instagram user ID), plus the content of messages exchanged and any AI
            draft replies generated for you.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">2. How it&apos;s used</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-text-secondary">
            <li>To operate your inbox — routing messages, showing conversation history, scheduling reminders and campaigns you create.</li>
            <li>To generate AI-drafted reply suggestions, using your Business Profile and the relevant conversation as context.</li>
            <li>To bill your business for the service.</li>
            <li>To investigate abuse or policy violations if reported.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">3. Who else sees it</h2>
          <p className="mt-2 text-text-secondary">
            We share data with the providers that make each channel and feature work, only as needed
            to deliver that feature:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-text-secondary">
            <li><strong>OpenAI or Anthropic</strong> — conversation content, to generate AI draft replies.</li>
            <li><strong>Resend</strong> — email content, to send and receive your Email channel messages.</li>
            <li><strong>Gupshup</strong> (as our WhatsApp Business Solution Provider) and <strong>Meta</strong> — message content, for your WhatsApp and Instagram channels.</li>
            <li><strong>Twilio</strong> — contact phone numbers and reminder message text, to place your scheduled Voice reminder calls.</li>
            <li><strong>Neon</strong> — our database host, where all of the above is stored.</li>
          </ul>
          <p className="mt-2 text-text-secondary">
            We do not sell customer data, and we do not use your customers&apos; data to train our own
            models.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">4. Security</h2>
          <p className="mt-2 text-text-secondary">
            Channel credentials you connect (bot tokens, API keys) are encrypted at rest (AES-256-GCM)
            — a database-level breach alone does not expose your live third-party credentials.
            Passwords are hashed, never stored in plain text. Each business&apos;s data is isolated by
            organization at the database level.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">5. Retention</h2>
          <p className="mt-2 text-text-secondary">
            We retain conversation and contact data for as long as your account is active. If you
            close your account, we will delete your organization&apos;s data within a reasonable
            period, except where we&apos;re required to keep records for legal or billing reasons.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">6. Your customers&apos; rights</h2>
          <p className="mt-2 text-text-secondary">
            If one of your customers wants their data removed from Evernaro, that request should go
            through you (the business they messaged) — you can delete a contact and their conversation
            history from your dashboard, or contact us for help.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">7. Changes</h2>
          <p className="mt-2 text-text-secondary">
            We&apos;ll update the date at the top of this page when this policy changes and notify
            active accounts of material changes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">8. Contact</h2>
          <p className="mt-2 text-text-secondary">
            Questions or data requests: email us at{" "}
            <a href="mailto:support@evernaro.com" className="text-primary hover:text-primary-hover">
              support@evernaro.com
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-10 text-xs text-text-muted">
        See also the <Link href="/terms" className="text-primary hover:text-primary-hover">Terms of Service</Link>.
      </p>

      <p className="mt-6 text-xs text-text-muted">
        This policy describes what Evernaro does with data today. It should still be reviewed by a
        lawyer familiar with Indian data-protection law and any other jurisdiction you sell into
        before being relied on as a final legal document.
      </p>
    </div>
  );
}
