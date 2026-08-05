import { sendEmail } from "@/lib/email";

const FROM = process.env.FROM_EMAIL || "EverReach <noreply@resend.dev>";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    from: FROM,
    to: email,
    subject: "Verify your EverReach email address",
    text: `Verify your email address for EverReach by opening this link:\n\n${url}\n\nThis link expires in 24 hours. If you did not create an account, you can ignore this email.`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    from: FROM,
    to: email,
    subject: "Reset your EverReach password",
    text: `Reset your EverReach password by opening this link:\n\n${url}\n\nThis link expires in 1 hour. If you did not request a password reset, you can ignore this email.`,
  });
}

export async function sendMfaBackupCodesUsedEmail(email: string) {
  await sendEmail({
    from: FROM,
    to: email,
    subject: "EverReach security alert: backup code used",
    text: `A backup code was used to sign in to your EverReach account. If this wasn't you, change your password and disable MFA from Settings > Security immediately.`,
  });
}
