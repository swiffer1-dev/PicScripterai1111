import axios from "axios";
import { OAuthProvider, OAuthTokenResponse } from "./base";

export class LinkedInOAuthProvider extends OAuthProvider {
  async exchangeCodeForTokens(code: string): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    
    const response = await axios.post(this.config.tokenUrl, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      tokenType: response.data.token_type || "Bearer",
      expiresIn: response.data.expires_in,
      scope: response.data.scope,
    };
  }
  
  async refreshTokens(refreshToken: string): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    
    const response = await axios.post(this.config.tokenUrl, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      tokenType: response.data.token_type || "Bearer",
      expiresIn: response.data.expires_in,
    };
  }
  
  async revokeToken(accessToken: string): Promise<void> {
    // LinkedIn doesn't have a standard revoke endpoint
    // Tokens expire naturally or can be revoked via the LinkedIn dashboard
  }
}
