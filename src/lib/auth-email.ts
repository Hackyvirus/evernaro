import {
  sendAuthEmail,
  sendSecurityEmail,
} from "@/lib/email-categories";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendAuthEmail({
    to: email,
    subject: "Verify your Evernaro email address",
    text: `Verify your email address for Evernaro by opening this link:\n\n${url}\n\nThis link expires in 24 hours. If you did not create an account, you can ignore this email.`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendAuthEmail({
    to: email,
    subject: "Reset your Evernaro password",
    text: `Reset your Evernaro password by opening this link:\n\n${url}\n\nThis link expires in 1 hour. If you did not request a password reset, you can ignore this email.`,
  });
}

export async function sendMfaBackupCodesUsedEmail(email: string) {
  await sendSecurityEmail({
    to: email,
    subject: "Evernaro security alert: backup code used",
    text: `A backup code was used to sign in to your Evernaro account. If this wasn't you, change your password and disable MFA from Settings > Security immediately.`,
  });
}

export async function sendWelcomeEmail(email: string, name: string | null) {
  const loginUrl = `${BASE_URL}/login`;
  await sendAuthEmail({
    to: email,
    subject: "Welcome to Evernaro",
    text: `Hi ${name ?? "there"},\n\nWelcome to Evernaro — your unified inbox for Telegram, Email, WhatsApp, Instagram, and Voice reminders.\n\nLog in here: ${loginUrl}\n\nIf you have any questions, reply to this email or contact support@evernaro.com.`,
  });
}

export async function sendTeamInviteEmail(
  email: string,
  name: string,
  orgName: string,
  tempPassword: string
) {
  const loginUrl = `${BASE_URL}/login`;
  await sendAuthEmail({
    to: email,
    subject: `You've been invited to join ${orgName} on Evernaro`,
    text: `Hi ${name},\n\nYou've been invited to join ${orgName} on Evernaro.\n\nLog in with the following temporary password:\n\n${tempPassword}\n\nLogin page: ${loginUrl}\n\nPlease change your password after logging in. If you did not expect this invitation, contact support@evernaro.com.`,
  });
}

export async function sendPasswordChangedEmail(email: string) {
  const loginUrl = `${BASE_URL}/login`;
  await sendSecurityEmail({
    to: email,
    subject: "Your Evernaro password was changed",
    text: `Your Evernaro password was just changed. If this was you, no action is needed.\n\nIf you did not make this change, reset your password immediately: ${loginUrl}\n\nContact support@evernaro.com if you need help.`,
  });
}
