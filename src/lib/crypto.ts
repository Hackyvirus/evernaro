import crypto from "crypto";

// Application-level encryption for channel credentials at rest (bot tokens,
// API keys, auth tokens) — a database-level compromise alone (leaked
// connection string, snapshot access) should not hand over every tenant's
// live third-party credentials in cleartext.
//
// ENCRYPTION_KEY must be a 32-byte key, base64-encoded. Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set — required to store or read channel credentials");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

// Stored as "iv:authTag:ciphertext", each hex-encoded.
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(stored: string): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted value");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

// Convenience wrappers for the common "encrypt if present" pattern.
export function encryptSecretOrNull(plaintext: string | null | undefined): string | null {
  return plaintext ? encryptSecret(plaintext) : null;
}

export function decryptSecretOrNull(stored: string | null | undefined): string | null {
  return stored ? decryptSecret(stored) : null;
}
