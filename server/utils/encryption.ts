import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

interface KeyStore {
  [kid: string]: string;
}

let keyCache: { keys: KeyStore; current: string } | null = null;

function loadKeyStore(): { keys: KeyStore; current: string } {
  if (keyCache) {
    return keyCache;
  }

  const currentKid = process.env.ENCRYPTION_KEY_CURRENT || "v1";
  let keys: KeyStore = {};

  // Try loading from ENCRYPTION_KEYS_JSON first (production approach)
  const keysJson = process.env.ENCRYPTION_KEYS_JSON;
  if (keysJson) {
    try {
      keys = JSON.parse(keysJson);
    } catch (error) {
      throw new Error("ENCRYPTION_KEYS_JSON is invalid JSON");
    }
  } else {
    // Fallback: support old ENCRYPTION_KEY format for backward compatibility
    const legacyKey = process.env.ENCRYPTION_KEY;
    if (!legacyKey) {
      throw new Error("Either ENCRYPTION_KEYS_JSON or ENCRYPTION_KEY must be set");
    }
    keys = { v1: legacyKey };
  }

  // Verify current key exists
  if (!keys[currentKid]) {
    throw new Error(`Current key ID "${currentKid}" not found in ENCRYPTION_KEYS_JSON`);
  }

  keyCache = { keys, current: currentKid };
  return keyCache;
}

function getEncryptionKey(kid: string): Buffer {
  const { keys } = loadKeyStore();
  
  const keyHex = keys[kid];
  if (!keyHex) {
    throw new Error(`Encryption key with ID "${kid}" not found`);
  }
  
  // Support both raw hex keys and passphrase-based keys
  if (keyHex.length === 64) {
    // 64 hex chars = 32 bytes, use directly
    return Buffer.from(keyHex, "hex");
  } else {
    // Derive 32-byte key from passphrase using SHA-256
    return crypto.createHash("sha256").update(keyHex).digest();
  }
}

export function encryptToken(token: string, kid?: string): string {
  const { current } = loadKeyStore();
  const keyId = kid || current;
  const key = getEncryptionKey(keyId);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  // Format: kid:iv:authTag:encryptedData (versioned for key rotation)
  return `${keyId}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptToken(encryptedToken: string): string {
  const parts = encryptedToken.split(":");
  
  let kid: string;
  let iv: Buffer;
  let authTag: Buffer;
  let encrypted: string;
  
  if (parts.length === 4) {
    // New versioned format: kid:iv:authTag:encryptedData
    kid = parts[0];
    iv = Buffer.from(parts[1], "hex");
    authTag = Buffer.from(parts[2], "hex");
    encrypted = parts[3];
    
    const key = getEncryptionKey(kid);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } else if (parts.length === 3) {
    // Legacy format: iv:authTag:encryptedData (no kid prefix)
    // Try to decrypt using v1 key for backward compatibility
    try {
      const key = getEncryptionKey("v1");
      
      iv = Buffer.from(parts[0], "hex");
      authTag = Buffer.from(parts[1], "hex");
      encrypted = parts[2];
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      
      return decrypted;
    } catch (error) {
      throw new Error("Failed to decrypt legacy token format. Ensure v1 key is in ENCRYPTION_KEYS_JSON");
    }
  } else {
    throw new Error("Invalid encrypted token format");
  }
}

export function getTokenKeyId(encryptedToken: string): string {
  const parts = encryptedToken.split(":");
  return parts.length === 4 ? parts[0] : "v1";
}

export function getCurrentKeyId(): string {
  const { current } = loadKeyStore();
  return current;
}

export function clearKeyCache(): void {
  keyCache = null;
}
