import * as OTPAuth from "otpauth";
import { randomBytes } from "node:crypto";

const ISSUER = "Evernaro";

export interface TotpSetup {
  secret: string;
  uri: string;
}

export function generateTotpSecret(email: string): TotpSetup {
  const secret = new OTPAuth.Secret({ size: 32 });
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
  return {
    secret: secret.base32,
    uri: totp.toString(),
  };
}

export function verifyTotpCode(encryptedBase32Secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(encryptedBase32Secret),
  });
  // Allow a single step of clock drift (±30s) on either side.
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const bytes = randomBytes(4);
    const num = bytes.readUInt32BE(0) % 1_000_000_000;
    codes.push(num.toString().padStart(9, "0"));
  }
  return codes;
}
