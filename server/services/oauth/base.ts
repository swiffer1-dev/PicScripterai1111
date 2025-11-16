import { Platform } from "@shared/schema";
import pkceChallenge from "pkce-challenge";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType: string;
  scope?: string;
}

export interface OAuthAccountInfo {
  accountId: string;
  accountHandle?: string;
}

export interface OAuthState {
  userId: string;
  platform: Platform;
  codeVerifier: string;
  timestamp: number;
}

export abstract class OAuthProvider {
  protected config: OAuthConfig;
  
  constructor(config: OAuthConfig) {
    this.config = config;
  }
  
  generateAuthUrl(state: string, codeChallenge?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(" "),
      state: state,
      response_type: "code",
    });
    
    if (codeChallenge) {
      params.append("code_challenge", codeChallenge);
      params.append("code_challenge_method", "S256");
    }
    
    return `${this.config.authUrl}?${params.toString()}`;
  }
  
  abstract exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<OAuthTokenResponse>;
  
  abstract refreshTokens(refreshToken: string): Promise<OAuthTokenResponse>;
  
  abstract revokeToken(accessToken: string): Promise<void>;
  
  async getAccountInfo(accessToken: string): Promise<OAuthAccountInfo | null> {
    return null;
  }
}

export function generatePKCE() {
  return pkceChallenge();
}
