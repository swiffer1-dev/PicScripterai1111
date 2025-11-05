import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const CURRENT_KEY_VERSION = "v1";

function getEncryptionKey(version: string = CURRENT_KEY_VERSION): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  
  // Support for future key rotation - check for versioned keys
  const versionedKey = process.env[`ENCRYPTION_KEY_${version.toUpperCase()}`];
  const keyToUse = versionedKey || key;
  
  // Ensure key is 32 bytes for AES-256
  return crypto.createHash("sha256").update(keyToUse).digest();
}

export function encryptToken(token: string, keyVersion: string = CURRENT_KEY_VERSION): string {
  const key = getEncryptionKey(keyVersion);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  // Format: version:iv:authTag:encryptedData (versioned for key rotation)
  return `${keyVersion}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptToken(encryptedToken: string): string {
  const parts = encryptedToken.split(":");
  
  // Support both old format (3 parts) and new versioned format (4 parts)
  let keyVersion: string;
  let iv: Buffer;
  let authTag: Buffer;
  let encrypted: string;
  
  if (parts.length === 4) {
    // New versioned format: version:iv:authTag:encryptedData
    keyVersion = parts[0];
    iv = Buffer.from(parts[1], "hex");
    authTag = Buffer.from(parts[2], "hex");
    encrypted = parts[3];
  } else if (parts.length === 3) {
    // Old format: iv:authTag:encryptedData (default to v1)
    keyVersion = CURRENT_KEY_VERSION;
    iv = Buffer.from(parts[0], "hex");
    authTag = Buffer.from(parts[1], "hex");
    encrypted = parts[2];
  } else {
    throw new Error("Invalid encrypted token format");
  }
  
  const key = getEncryptionKey(keyVersion);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

export function getTokenKeyVersion(encryptedToken: string): string {
  const parts = encryptedToken.split(":");
  return parts.length === 4 ? parts[0] : CURRENT_KEY_VERSION;
}
