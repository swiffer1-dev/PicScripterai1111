import axios from "axios";
import { OAuthProvider, OAuthTokenResponse } from "./base";

export class TikTokOAuthProvider extends OAuthProvider {
  async exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      client_key: this.config.clientId,
      client_secret: this.config.clientSecret,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: this.config.redirectUri,
    });
    
    if (codeVerifier) {
      params.append("code_verifier", codeVerifier);
    }
    
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
      client_key: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
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
    const params = new URLSearchParams({
      client_key: this.config.clientId,
      client_secret: this.config.clientSecret,
      token: accessToken,
    });
    
    await axios.post("https://open.tiktokapis.com/v2/oauth/revoke/", params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  }
}
