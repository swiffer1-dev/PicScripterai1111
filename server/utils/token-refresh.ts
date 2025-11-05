import { storage } from "../storage";
import { getOAuthProvider } from "../services/oauth/factory";
import { encryptToken, decryptToken } from "./encryption";
import type { Connection, Platform } from "@shared/schema";

export class TokenRefreshError extends Error {
  constructor(
    message: string,
    public readonly platform: Platform,
    public readonly isUserActionRequired: boolean = false
  ) {
    super(message);
    this.name = "TokenRefreshError";
  }
}

export async function ensureValidToken(connection: Connection): Promise<string> {
  // Check if token is expired or expiring soon (within 5 minutes)
  const now = new Date();
  const expiresAt = connection.expiresAt;
  
  if (!expiresAt || expiresAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    // Token is still valid
    try {
      return decryptToken(connection.accessTokenEnc);
    } catch (error: any) {
      throw new TokenRefreshError(
        `Failed to decrypt token: ${error.message}`,
        connection.platform,
        true
      );
    }
  }
  
  // Token is expired or expiring soon, refresh it
  if (!connection.refreshTokenEnc) {
    throw new TokenRefreshError(
      "No refresh token available. Please reconnect your account.",
      connection.platform,
      true
    );
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
    // Graceful failure - check if refresh token is invalid
    if (
      error.message?.includes("invalid_grant") ||
      error.message?.includes("invalid_token") ||
      error.message?.includes("token_revoked")
    ) {
      throw new TokenRefreshError(
        `Your ${connection.platform} connection has expired. Please reconnect your account.`,
        connection.platform,
        true
      );
    }
    
    // Temporary network or service error - allow retry
    if (
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("ETIMEDOUT") ||
      error.message?.includes("503")
    ) {
      throw new TokenRefreshError(
        `Temporary error refreshing ${connection.platform} token. Please try again.`,
        connection.platform,
        false
      );
    }
    
    // Unknown error
    throw new TokenRefreshError(
      `Failed to refresh ${connection.platform} token: ${error.message}`,
      connection.platform,
      false
    );
  }
}
