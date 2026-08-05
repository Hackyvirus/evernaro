import { describe, it, expect } from "vitest";
import { generateTotpSecret, verifyTotpCode, generateBackupCodes } from "./totp";

describe("totp", () => {
  it("generates backup codes with the expected format", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(8);
    for (const code of codes) {
      expect(code).toMatch(/^\d{9}$/);
    }
  });

  it("verifies a TOTP code generated from the same secret", () => {
    const { secret } = generateTotpSecret("test@example.com");
    const totp = new (require("otpauth").TOTP)({
      secret: require("otpauth").Secret.fromBase32(secret),
      digits: 6,
      period: 30,
    });
    const code = totp.generate();
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it("rejects an invalid TOTP code", () => {
    const { secret } = generateTotpSecret("test@example.com");
    expect(verifyTotpCode(secret, "000000")).toBe(false);
  });
});
