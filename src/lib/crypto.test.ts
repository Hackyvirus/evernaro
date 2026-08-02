import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  // A valid-shaped 32-byte key — not a real secret, just satisfies getKey()'s
  // length check so the round-trip can run.
  process.env.ENCRYPTION_KEY = "t839W+DYA1mBYNvgwYI/LrYYYToBb4JjbbF5CWJzpvU=";
});

describe("crypto", () => {
  it("round-trips a secret through encrypt/decrypt", async () => {
    const { encryptSecret, decryptSecret } = await import("./crypto");
    const plaintext = "sk-test-some-channel-api-key-1234567890";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", async () => {
    const { encryptSecret } = await import("./crypto");
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toBe(b);
  });

  it("rejects a tampered ciphertext instead of silently returning garbage", async () => {
    const { encryptSecret, decryptSecret } = await import("./crypto");
    const encrypted = encryptSecret("tamper-me");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const flipped = ciphertext.slice(0, -2) + (ciphertext.slice(-2) === "00" ? "ff" : "00");
    expect(() => decryptSecret(`${iv}:${authTag}:${flipped}`)).toThrow();
  });

  it("encryptSecretOrNull/decryptSecretOrNull pass through null and undefined", async () => {
    const { encryptSecretOrNull, decryptSecretOrNull } = await import("./crypto");
    expect(encryptSecretOrNull(null)).toBeNull();
    expect(encryptSecretOrNull(undefined)).toBeNull();
    expect(decryptSecretOrNull(null)).toBeNull();
    expect(decryptSecretOrNull(undefined)).toBeNull();
  });
});
