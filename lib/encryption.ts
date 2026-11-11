/**
 * Authenticated Encryption & Key Masking Utilities.
 * Implements AES-256-GCM with authentication tag validation.
 * Uses SHA-256 derived key from AUTH_SECRET.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { env } from "./env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Derives a consistent 256-bit encryption key from AUTH_SECRET.
 */
function getEncryptionKey(): Buffer {
  return createHash("sha256").update(env.AUTH_SECRET).digest();
}

/**
 * Encrypts a plaintext string into a safe colon-delimited string:
 * `iv:authTag:ciphertext` (all in hex).
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return "";

  const iv = randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a cipher string in `iv:authTag:ciphertext` format.
 * Returns the decrypted plaintext or fallback if decryption fails.
 */
export function decryptSecret(payload: string): string {
  if (!payload) return "";

  // If not in encrypted format (e.g. legacy plain key or test key), return as is
  if (!payload.includes(":")) {
    return payload;
  }

  const parts = payload.split(":");
  if (parts.length !== 3) {
    return payload;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const key = getEncryptionKey();

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    // If decryption fails (e.g. tampering or altered secret), fail gracefully
    return "";
  }
}

/**
 * Masks a secret key for UI presentation.
 * Example: `pk_test_1234567890abcdef` -> `pk_test_••••••••cdef`
 */
export function maskSecretKey(key: string): string {
  if (!key) return "";

  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return "••••••••";
  }

  const prefixMatch = trimmed.match(/^([a-z0-9]+_[a-z0-9]+_)/i);
  const prefix = prefixMatch ? prefixMatch[1] : trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);

  return `${prefix}${"•".repeat(8)}${suffix}`;
}

/**
 * Encrypts a customer ID/Passport number using AES-256-GCM.
 */
export function encryptIdNumber(plainId: string): string {
  return encryptSecret(plainId);
}

/**
 * Decrypts an encrypted customer ID/Passport number.
 */
export function decryptIdNumber(cipherPayload: string): string {
  return decryptSecret(cipherPayload);
}
