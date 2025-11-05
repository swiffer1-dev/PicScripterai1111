import { EcommercePlatform } from "@shared/schema";

export interface EcommerceOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

export interface EcommerceOAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType: string;
  scope?: string;
}

export interface EcommerceOAuthState {
  userId: string;
  platform: EcommercePlatform;
  codeVerifier: string;
  timestamp: number;
}

export interface StoreInfo {
  storeId: string;
  storeName: string;
  storeUrl?: string;
}

export interface EcommerceProduct {
  id: string;
  title: string;
  description?: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
  productUrl?: string;
  sku?: string;
  inventory?: number;
  tags?: string[];
  metadata?: any;
}

export abstract class EcommerceOAuthProvider {
  protected config: EcommerceOAuthConfig;
  
  constructor(config: EcommerceOAuthConfig) {
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
  
  abstract exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<EcommerceOAuthTokenResponse>;
  
  abstract refreshTokens(refreshToken: string): Promise<EcommerceOAuthTokenResponse>;
  
  abstract revokeToken(accessToken: string): Promise<void>;
  
  abstract getStoreInfo(accessToken: string): Promise<StoreInfo>;
  
  abstract getProducts(accessToken: string): Promise<EcommerceProduct[]>;
}
