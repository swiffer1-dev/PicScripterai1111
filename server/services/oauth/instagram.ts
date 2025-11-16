import axios from "axios";
import { OAuthProvider, OAuthTokenResponse } from "./base";

export class InstagramOAuthProvider extends OAuthProvider {
  async exchangeCodeForTokens(code: string): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      code: code,
    });
    
    const response = await axios.get(`${this.config.tokenUrl}?${params.toString()}`);
    
    return {
      accessToken: response.data.access_token,
      tokenType: response.data.token_type || "Bearer",
      expiresIn: response.data.expires_in,
    };
  }
  
  async refreshTokens(refreshToken: string): Promise<OAuthTokenResponse> {
    const response = await axios.get(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${refreshToken}`
    );
    
    return {
      accessToken: response.data.access_token,
      tokenType: "Bearer",
      expiresIn: response.data.expires_in,
    };
  }
  
  async revokeToken(accessToken: string): Promise<void> {
    // Instagram doesn't have a direct revoke endpoint
    // User must manually disconnect from Facebook settings
  }
}
