import { storage } from "../storage";
import { getOAuthProvider } from "../services/oauth/factory";
import { encryptToken, decryptToken } from "./encryption";
import type { Connection, Platform } from "@shared/schema";

export async function ensureValidToken(connection: Connection): Promise<string> {
  // Check if token is expired or expiring soon (within 5 minutes)
  const now = new Date();
  const expiresAt = connection.expiresAt;
  
  if (!expiresAt || expiresAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    // Token is still valid
    return decryptToken(connection.accessTokenEnc);
  }
  
  // Token is expired or expiring soon, refresh it
  if (!connection.refreshTokenEnc) {
    throw new Error("No refresh token available");
  }
  
  try {
    const refreshToken = decryptToken(connection.refreshTokenEnc);
    const provider = getOAuthProvider(connection.platform);
    
    // Refresh the token
    const newTokens = await provider.refreshTokens(refreshToken);
    
    // Encrypt new tokens
    const accessTokenEnc = encryptToken(newTokens.accessToken);
    const refreshTokenEnc = newTokens.refreshToken
      ? encryptToken(newTokens.refreshToken)
      : connection.refreshTokenEnc;
    
    // Calculate new expiration
    const newExpiresAt = newTokens.expiresIn
      ? new Date(Date.now() + newTokens.expiresIn * 1000)
      : undefined;
    
    // Update connection in database
    await storage.updateConnection(connection.id, {
      accessTokenEnc,
      refreshTokenEnc,
      expiresAt: newExpiresAt,
    });
    
    return newTokens.accessToken;
  } catch (error: any) {
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
}
