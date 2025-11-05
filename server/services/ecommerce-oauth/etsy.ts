import axios from "axios";
import { EcommerceOAuthProvider, EcommerceOAuthTokenResponse, StoreInfo, EcommerceProduct } from "./base";

export class EtsyOAuthProvider extends EcommerceOAuthProvider {
  async exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<EcommerceOAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      code: code,
      code_verifier: codeVerifier || "",
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
      expiresIn: response.data.expires_in, // 3600 seconds (1 hour)
    };
  }

  async refreshTokens(refreshToken: string): Promise<EcommerceOAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.config.clientId,
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
    // Etsy doesn't have a public revoke endpoint
    console.log("Etsy tokens must be revoked via Etsy developer dashboard");
  }

  async getStoreInfo(accessToken: string): Promise<StoreInfo> {
    // Get user info first
    const userResponse = await axios.get("https://openapi.etsy.com/v3/application/users/me", {
      headers: {
        "x-api-key": this.config.clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userId = userResponse.data.user_id;

    // Get user's shops to find the primary shop
    const shopsResponse = await axios.get(
      `https://openapi.etsy.com/v3/application/users/${userId}/shops`,
      {
        headers: {
          "x-api-key": this.config.clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Get the first shop (typically the user's primary shop)
    const shop = shopsResponse.data.results?.[0] || shopsResponse.data[0];
    
    if (!shop) {
      throw new Error("No Etsy shop found for this user");
    }

    return {
      storeId: shop.shop_id.toString(),
      storeName: shop.shop_name,
      storeUrl: shop.url,
    };
  }

  async getProducts(accessToken: string): Promise<EcommerceProduct[]> {
    // First get the user's actual shop ID
    const userResponse = await axios.get("https://openapi.etsy.com/v3/application/users/me", {
      headers: {
        "x-api-key": this.config.clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userId = userResponse.data.user_id;

    // Get user's shops
    const shopsResponse = await axios.get(
      `https://openapi.etsy.com/v3/application/users/${userId}/shops`,
      {
        headers: {
          "x-api-key": this.config.clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const shop = shopsResponse.data.results?.[0] || shopsResponse.data[0];
    
    if (!shop) {
      throw new Error("No Etsy shop found for this user");
    }

    const shopId = shop.shop_id;

    // Get shop listings
    const listingsResponse = await axios.get(
      `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/active`,
      {
        headers: {
          "x-api-key": this.config.clientId,
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          limit: 100,
          includes: "Images",
        },
      }
    );

    const listings = listingsResponse.data.results || [];
    return listings.map((listing: any) => ({
      id: listing.listing_id.toString(),
      title: listing.title,
      description: listing.description,
      price: listing.price?.amount ? (listing.price.amount / listing.price.divisor).toFixed(2) : undefined,
      currency: listing.price?.currency_code,
      imageUrl: listing.images?.[0]?.url_570xN,
      productUrl: listing.url,
      sku: listing.sku?.[0],
      inventory: listing.quantity,
      tags: listing.tags || [],
      metadata: {
        state: listing.state,
        views: listing.views,
        numFavorers: listing.num_favorers,
      },
    }));
  }
}
