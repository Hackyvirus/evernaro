import { sendEmail } from "@/lib/email";

const FROM = process.env.FROM_EMAIL || "Evernaro <hello@evernaro.com>";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    from: FROM,
    to: email,
    subject: "Verify your Evernaro email address",
    text: `Verify your email address for Evernaro by opening this link:\n\n${url}\n\nThis link expires in 24 hours. If you did not create an account, you can ignore this email.`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    from: FROM,
    to: email,
    subject: "Reset your Evernaro password",
    text: `Reset your Evernaro password by opening this link:\n\n${url}\n\nThis link expires in 1 hour. If you did not request a password reset, you can ignore this email.`,
  });
}

export async function sendMfaBackupCodesUsedEmail(email: string) {
  await sendEmail({
    from: FROM,
    to: email,
    subject: "Evernaro security alert: backup code used",
    text: `A backup code was used to sign in to your Evernaro account. If this wasn't you, change your password and disable MFA from Settings > Security immediately.`,
  });
}
