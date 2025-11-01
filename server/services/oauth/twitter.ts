import axios from "axios";
import { OAuthProvider, OAuthTokenResponse } from "./base";

export class TwitterOAuthProvider extends OAuthProvider {
  async exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<OAuthTokenResponse> {
    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    
    const params = new URLSearchParams({
      code: code,
      grant_type: "authorization_code",
      redirect_uri: this.config.redirectUri,
      code_verifier: codeVerifier || "",
    });
    
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
    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    
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
    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    
    await axios.post("https://api.twitter.com/2/oauth2/revoke", 
      new URLSearchParams({ token: accessToken }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
      }
    );
  }
}
