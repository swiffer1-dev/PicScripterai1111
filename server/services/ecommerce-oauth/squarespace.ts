import axios from "axios";
import { EcommerceOAuthProvider, EcommerceOAuthTokenResponse, StoreInfo, EcommerceProduct } from "./base";

export class SquarespaceOAuthProvider extends EcommerceOAuthProvider {
  generateAuthUrl(state: string, codeChallenge?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(","), // Squarespace uses comma-separated scopes
      state: state,
      response_type: "code",
      access_type: "offline", // Request refresh token
    });

    return `${this.config.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<EcommerceOAuthTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
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
      expiresIn: response.data.expires_in, // 1800 seconds (30 minutes)
    };
  }

  async refreshTokens(refreshToken: string): Promise<EcommerceOAuthTokenResponse> {
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
    // Squarespace doesn't have a public revoke endpoint
    console.log("Squarespace tokens can be revoked by user via their Squarespace account");
  }

  async getStoreInfo(accessToken: string): Promise<StoreInfo> {
    const response = await axios.get("https://api.squarespace.com/1.0/authorization/website", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Picscripter/1.0",
      },
    });

    const site = response.data.website;
    return {
      storeId: site.id,
      storeName: site.siteTitle || site.baseUrl,
      storeUrl: site.baseUrl,
    };
  }

  async getProducts(accessToken: string): Promise<EcommerceProduct[]> {
    const response = await axios.get("https://api.squarespace.com/1.0/commerce/products", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Picscripter/1.0",
      },
      params: {
        limit: 100,
      },
    });

    const products = response.data.products || [];
    return products.map((product: any) => ({
      id: product.id,
      title: product.name,
      description: product.description,
      price: product.variants?.[0]?.pricing?.basePrice?.value,
      currency: product.variants?.[0]?.pricing?.basePrice?.currency,
      imageUrl: product.images?.[0]?.url,
      productUrl: product.url,
      sku: product.variants?.[0]?.sku,
      inventory: product.variants?.[0]?.stock?.quantity,
      tags: product.tags || [],
      metadata: {
        type: product.type,
        isVisible: product.isVisible,
      },
    }));
  }
}
