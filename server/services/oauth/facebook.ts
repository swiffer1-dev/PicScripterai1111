import axios from "axios";
import { OAuthProvider, OAuthTokenResponse } from "./base";

export class FacebookOAuthProvider extends OAuthProvider {
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
    // Facebook uses long-lived tokens instead of refresh tokens
    // Exchange short-lived token for long-lived token
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      fb_exchange_token: refreshToken,
    });
    
    const response = await axios.get(`${this.config.tokenUrl}?${params.toString()}`);
    
    return {
      accessToken: response.data.access_token,
      tokenType: response.data.token_type || "Bearer",
      expiresIn: response.data.expires_in,
    };
  }
  
  async revokeToken(accessToken: string): Promise<void> {
    await axios.delete(`https://graph.facebook.com/v18.0/me/permissions?access_token=${accessToken}`);
  }
}
