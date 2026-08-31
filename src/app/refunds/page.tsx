import Link from "next/link";

export const metadata = { title: "Refund & Cancellation Policy — Evernaro" };

export default function RefundsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 text-sm leading-relaxed text-text">
      <Link href="/" className="text-primary hover:text-primary-hover">
        ← Evernaro
      </Link>

      <h1 className="mt-6 text-2xl font-semibold">Refund &amp; Cancellation Policy</h1>
      <p className="mt-1 text-text-secondary">Last updated: 31 August 2026</p>

      <div className="mt-8 flex flex-col gap-6">
        <section>
          <h2 className="text-base font-semibold">1. Scope</h2>
          <p className="mt-2 text-text-secondary">
            This policy covers payments made to Eversity Tech LLP for the Evernaro service:
            subscription plan fees and prepaid WhatsApp wallet top-ups. It applies alongside the{" "}
            <Link href="/terms" className="text-primary hover:text-primary-hover">
              Terms of Service
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">2. Free trial</h2>
          <p className="mt-2 text-text-secondary">
            Paid plans start with a free trial. No charge is made until the trial ends. If you
            cancel before the trial ends, you are not billed and there is nothing to refund.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">3. Subscription fees</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-text-secondary">
            <li>
              Subscription fees are billed in advance for the billing period you select (monthly or
              annual) and are generally non-refundable once the period has begun.
            </li>
            <li>
              <strong>7-day satisfaction window:</strong> if you are a new paying customer and email
              us within 7 days of your first paid charge, we will refund that charge in full.
            </li>
            <li>
              You can cancel at any time from Settings → Billing, or by emailing us. Cancellation
              stops the next renewal; your plan stays active until the end of the period already
              paid for, and no partial-period refund is issued for the unused days.
            </li>
            <li>
              If we materially reduce or discontinue the service during a period you have paid for,
              we will refund the unused portion on a pro-rata basis.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">4. WhatsApp wallet top-ups</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-text-secondary">
            <li>
              Wallet top-ups pre-fund per-message costs charged by Meta/WhatsApp through our BSP
              partner. Amounts already consumed by sent messages cannot be refunded.
            </li>
            <li>
              An <strong>unused</strong> wallet balance can be refunded on request if you close your
              account, less any payment-gateway fees that cannot be recovered.
            </li>
            <li>Wallet balance is not transferable between organizations and has no cash value beyond funding sends.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">5. How to request a refund</h2>
          <p className="mt-2 text-text-secondary">
            Email{" "}
            <a href="mailto:billing@evernaro.com" className="text-primary hover:text-primary-hover">
              billing@evernaro.com
            </a>{" "}
            from the email address on your account, with your organization name and the payment date
            or Razorpay payment ID. We aim to respond within 3 business days.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">6. How refunds are paid</h2>
          <p className="mt-2 text-text-secondary">
            Approved refunds are made to the original payment method through Razorpay. Once
            initiated, it typically takes 5–7 business days for the amount to appear, depending on
            your bank or card issuer.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">7. Chargebacks</h2>
          <p className="mt-2 text-text-secondary">
            Please contact us first — we can usually resolve billing issues faster than a bank
            dispute. Accounts with an unresolved chargeback may be suspended until it is settled.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">8. Contact</h2>
          <p className="mt-2 text-text-secondary">
            Eversity Tech LLP — billing questions:{" "}
            <a href="mailto:billing@evernaro.com" className="text-primary hover:text-primary-hover">
              billing@evernaro.com
            </a>
            . General support:{" "}
            <a href="mailto:support@evernaro.com" className="text-primary hover:text-primary-hover">
              support@evernaro.com
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-10 text-xs text-text-muted">
        See also the{" "}
        <Link href="/terms" className="text-primary hover:text-primary-hover">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-primary hover:text-primary-hover">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="mt-6 text-xs text-text-muted">
        This policy reflects how Evernaro billing works today. Have it reviewed by a lawyer familiar
        with Indian consumer and contract law before relying on it as a final legal document for
        paid customers.
      </p>
    </div>
  );
}
