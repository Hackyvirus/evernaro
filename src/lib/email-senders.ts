/**
 * Centralized email sender identities for the Evernaro platform.
 *
 * Every outbound email must use the sender identity matching its purpose.
 * Do not scatter email addresses in individual email helpers or API routes.
 *
 * These addresses must be verified in Resend before emails will deliver.
 */
export const EMAIL_SENDERS = {
  auth: {
    from: "Evernaro <auth@evernaro.com>",
    replyTo: "support@evernaro.com",
  },
  billing: {
    from: "Evernaro Billing <billing@evernaro.com>",
    replyTo: "support@evernaro.com",
  },
  support: {
    from: "Evernaro Support <support@evernaro.com>",
    replyTo: "support@evernaro.com",
  },
  contact: {
    from: "Evernaro <contact@evernaro.com>",
    replyTo: "contact@evernaro.com",
  },
  notifications: {
    from: "Evernaro <notifications@evernaro.com>",
    replyTo: "support@evernaro.com",
  },
  security: {
    from: "Evernaro Security <security@evernaro.com>",
    replyTo: "support@evernaro.com",
  },
  marketing: {
    from: "Evernaro <updates@evernaro.com>",
    replyTo: "support@evernaro.com",
  },
} as const;

export type EmailCategory = keyof typeof EMAIL_SENDERS;
