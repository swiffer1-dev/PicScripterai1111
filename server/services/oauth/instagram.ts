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
      console.log('[Instagram OAuth] Fetching pages with IG business accounts...');
      console.log('[Instagram OAuth] Access token (first 20 chars):', accessToken.substring(0, 20));
      
      // Request page access token AND instagram_business_account
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=instagram_business_account,access_token,name`
      );
      
      console.log(`[Instagram OAuth] Found ${response.data.data?.length || 0} pages`);
      console.log('[Instagram OAuth] Pages data:', JSON.stringify(response.data.data, null, 2));
      
      if (response.data.data && response.data.data.length > 0) {
        // Iterate through all pages to find one with an Instagram Business Account
        for (const page of response.data.data) {
          console.log(`[Instagram OAuth] Checking page: ${page.name || 'Unnamed'}`);
          console.log(`[Instagram OAuth] Page has IG account: ${!!page.instagram_business_account}`);
          
          if (page.instagram_business_account && page.access_token) {
            const igAccountId = page.instagram_business_account.id;
            const pageAccessToken = page.access_token;
            
            console.log(`[Instagram OAuth] Found IG business account: ${igAccountId}`);
            
            // Use PAGE access token (not user token) to fetch IG account details
            const igResponse = await axios.get(
              `https://graph.facebook.com/v18.0/${igAccountId}?access_token=${pageAccessToken}&fields=username`
            );
            
            console.log(`[Instagram OAuth] Successfully fetched IG username: ${igResponse.data.username}`);
            
            return {
              accountId: igAccountId,
              accountHandle: igResponse.data.username,
            };
          }
        }
        
        console.warn('[Instagram OAuth] No pages with Instagram Business Account found');
        console.warn('[Instagram OAuth] This usually means:');
        console.warn('[Instagram OAuth] 1. The Instagram account is not a Business/Creator account');
        console.warn('[Instagram OAuth] 2. The Instagram account is not linked to the Facebook Page');
        console.warn('[Instagram OAuth] 3. Permissions were not granted during authorization');
      } else {
        console.warn('[Instagram OAuth] No pages found at all - check if user manages any Facebook Pages');
      }
      
      return null;
    } catch (error: any) {
      console.error("[Instagram OAuth] Account info error:", error.response?.data || error.message);
      if (error.response?.data) {
        console.error("[Instagram OAuth] Full error response:", JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }
}
