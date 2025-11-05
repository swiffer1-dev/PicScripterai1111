import axios from "axios";
import { EcommerceOAuthProvider, EcommerceOAuthTokenResponse, StoreInfo, EcommerceProduct } from "./base";

export class ShopifyOAuthProvider extends EcommerceOAuthProvider {
  private shopDomain: string;

  constructor(config: any, shopDomain: string) {
    super(config);
    this.shopDomain = shopDomain;
  }

  generateAuthUrl(state: string, codeChallenge?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: this.config.scopes.join(","), // Shopify uses comma-separated scopes
      redirect_uri: this.config.redirectUri,
      state: state,
    });

    return `https://${this.shopDomain}/admin/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<EcommerceOAuthTokenResponse> {
    const response = await axios.post(
      `https://${this.shopDomain}/admin/oauth/access_token`,
      {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
      }
    );

    return {
      accessToken: response.data.access_token,
      tokenType: "Bearer",
      scope: response.data.scope,
    };
  }

  async refreshTokens(refreshToken: string): Promise<EcommerceOAuthTokenResponse> {
    // Shopify access tokens don't expire
    throw new Error("Shopify access tokens do not require refresh");
  }

  async revokeToken(accessToken: string): Promise<void> {
    // Revoke via Shopify admin - no API endpoint
    console.log("Shopify tokens must be revoked via Shopify admin dashboard");
  }

  async getStoreInfo(accessToken: string): Promise<StoreInfo> {
    const response = await axios.get(`https://${this.shopDomain}/admin/api/2025-01/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
      },
    });

    const shop = response.data.shop;
    return {
      storeId: shop.id.toString(),
      storeName: shop.name,
      storeUrl: shop.domain,
    };
  }

  async getProducts(accessToken: string): Promise<EcommerceProduct[]> {
    const response = await axios.get(`https://${this.shopDomain}/admin/api/2025-01/products.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
      },
      params: {
        limit: 250, // Max allowed per request
      },
    });

    const products = response.data.products || [];
    return products.map((product: any) => ({
      id: product.id.toString(),
      title: product.title,
      description: product.body_html,
      price: product.variants?.[0]?.price,
      currency: "USD", // Shopify doesn't return currency in product data
      imageUrl: product.image?.src || product.images?.[0]?.src,
      productUrl: `https://${this.shopDomain}/products/${product.handle}`,
      sku: product.variants?.[0]?.sku,
      inventory: product.variants?.[0]?.inventory_quantity,
      tags: product.tags?.split(",").map((t: string) => t.trim()) || [],
      metadata: {
        vendor: product.vendor,
        productType: product.product_type,
        handle: product.handle,
      },
    }));
  }
}
