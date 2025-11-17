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
      
      // Request pages with both old and new Instagram field names
      const pagesResponse = await axios.get(
        `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=instagram_business_account,connected_instagram_account,access_token,name,id`
      );
      
      console.log(`[Instagram OAuth] Found ${pagesResponse.data.data?.length || 0} pages`);
      
      if (pagesResponse.data.data && pagesResponse.data.data.length > 0) {
        // Iterate through all pages to find one with an Instagram account
        for (const page of pagesResponse.data.data) {
          console.log(`[Instagram OAuth] Checking page: ${page.name || 'Unnamed'} (ID: ${page.id})`);
          
          if (!page.access_token) {
            console.log(`[Instagram OAuth] Page ${page.name} has no access_token, skipping`);
            continue;
          }
          
          // Re-query the page with its own token to get detailed IG account info
          // This is necessary because Meta now returns IG accounts under different fields
          try {
            const pageDetailResponse = await axios.get(
              `https://graph.facebook.com/v18.0/${page.id}?access_token=${page.access_token}&fields=instagram_business_account{id,username},connected_instagram_account{id,username}`
            );
            
            console.log(`[Instagram OAuth] Page ${page.name} detail:`, JSON.stringify(pageDetailResponse.data, null, 2));
            
            // Check both field variants (instagram_business_account is older, connected_instagram_account is newer)
            const igAccount = pageDetailResponse.data.instagram_business_account || pageDetailResponse.data.connected_instagram_account;
            
            if (igAccount && igAccount.id && igAccount.username) {
              console.log(`[Instagram OAuth] ✓ Found Instagram account: @${igAccount.username} (ID: ${igAccount.id})`);
              
              return {
                accountId: igAccount.id,
                accountHandle: igAccount.username,
              };
            } else {
              console.log(`[Instagram OAuth] Page ${page.name} has no Instagram account linked`);
            }
          } catch (pageError: any) {
            console.error(`[Instagram OAuth] Error fetching details for page ${page.name}:`, pageError.response?.data || pageError.message);
          }
        }
        
        console.error('[Instagram OAuth] ✗ No Instagram Business Account found across all pages');
        console.error('[Instagram OAuth] Possible reasons:');
        console.error('[Instagram OAuth] 1. Instagram account is not a Business/Creator account');
        console.error('[Instagram OAuth] 2. Instagram account is not linked to any Facebook Page');
        console.error('[Instagram OAuth] 3. Required permissions were not granted during authorization');
        console.error('[Instagram OAuth] 4. The linked Instagram account is not accessible via the Graph API');
      } else {
        console.error('[Instagram OAuth] ✗ No Facebook Pages found');
        console.error('[Instagram OAuth] User must manage at least one Facebook Page to connect Instagram');
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
