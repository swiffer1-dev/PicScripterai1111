import axios from "axios";
import { OAuthProvider, OAuthTokenResponse, OAuthAccountInfo } from "./base";

export class InstagramOAuthProvider extends OAuthProvider {
  async exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<OAuthTokenResponse> {
    try {
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        code: code,
        grant_type: "authorization_code",
      });
      
      if (codeVerifier) {
        params.append("code_verifier", codeVerifier);
      }
      
      const response = await axios.post(this.config.tokenUrl, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      
      return {
        accessToken: response.data.access_token,
        tokenType: response.data.token_type || "Bearer",
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      console.error("Instagram token exchange error:", error.response?.data || error.message);
      throw error;
    }
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
  
  async getAccountInfo(accessToken: string): Promise<OAuthAccountInfo | null> {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=instagram_business_account`
      );
      
      if (response.data.data && response.data.data.length > 0) {
        const page = response.data.data[0];
        if (page.instagram_business_account) {
          const igAccountId = page.instagram_business_account.id;
          
          const igResponse = await axios.get(
            `https://graph.facebook.com/v18.0/${igAccountId}?access_token=${accessToken}&fields=username`
          );
          
          return {
            accountId: igAccountId,
            accountHandle: igResponse.data.username,
          };
        }
      }
      
      return null;
    } catch (error: any) {
      console.error("Instagram account info error:", error.response?.data || error.message);
      return null;
    }
  }
}
