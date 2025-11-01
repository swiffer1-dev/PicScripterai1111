import axios from "axios";
import { OAuthProvider, OAuthTokenResponse } from "./base";

export class PinterestOAuthProvider extends OAuthProvider {
  async exchangeCodeForTokens(code: string): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: this.config.redirectUri,
    });
    
    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    
    const response = await axios.post(this.config.tokenUrl, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
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
    });
    
    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    
    const response = await axios.post(this.config.tokenUrl, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
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
    // Pinterest doesn't have a public revoke endpoint documented
    // Tokens can be revoked via the Pinterest developer dashboard
  }
}
