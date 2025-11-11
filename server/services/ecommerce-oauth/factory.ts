import { EcommercePlatform } from "@shared/schema";
import { EcommerceOAuthProvider } from "./base";
import { ShopifyOAuthProvider } from "./shopify";
import { EtsyOAuthProvider } from "./etsy";
import { SquarespaceOAuthProvider } from "./squarespace";

// Use dedicated OAuth callback base URL
// Falls back to first CORS origin or localhost for development
const getOAuthBaseUrl = (): string => {
  // Prefer dedicated OAuth URL for security
  if (process.env.OAUTH_CALLBACK_BASE_URL) {
    return process.env.OAUTH_CALLBACK_BASE_URL;
  }
  
  // Fallback: use first CORS origin (split comma-separated list)
  if (process.env.CORS_ORIGIN) {
    const origins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
    return origins[0];
  }
  
  // Development fallback
  return "http://localhost:5000";
};

const BASE_URL = getOAuthBaseUrl();

export function getEcommerceOAuthProvider(
  platform: EcommercePlatform,
  shopDomain?: string
): EcommerceOAuthProvider {
  const redirectUri = `${BASE_URL}/api/ecommerce/callback/${platform}`;

  switch (platform) {
    case "shopify":
      if (!shopDomain) {
        throw new Error("Shop domain is required for Shopify");
      }
      return new ShopifyOAuthProvider(
        {
          clientId: process.env.SHOPIFY_CLIENT_ID || "",
          clientSecret: process.env.SHOPIFY_CLIENT_SECRET || "",
          redirectUri,
          scopes: ["read_products", "read_orders", "read_inventory"],
          authUrl: "", // Not used - constructed in provider
          tokenUrl: "", // Not used - constructed in provider
        },
        shopDomain
      );

    case "etsy":
      return new EtsyOAuthProvider({
        clientId: process.env.ETSY_CLIENT_ID || "",
        clientSecret: process.env.ETSY_CLIENT_SECRET || "",
        redirectUri,
        scopes: ["transactions_r", "listings_r", "shops_r"],
        authUrl: "https://www.etsy.com/oauth/connect",
        tokenUrl: "https://api.etsy.com/v3/public/oauth/token",
      });

    case "squarespace":
      return new SquarespaceOAuthProvider({
        clientId: process.env.SQUARESPACE_CLIENT_ID || "",
        clientSecret: process.env.SQUARESPACE_CLIENT_SECRET || "",
        redirectUri,
        scopes: ["website.orders.read", "website.inventory.read", "website.products.read"],
        authUrl: "https://login.squarespace.com/api/1/login/oauth/provider/authorize",
        tokenUrl: "https://login.squarespace.com/api/1/login/oauth/provider/tokens",
      });

    default:
      throw new Error(`Unsupported e-commerce platform: ${platform}`);
  }
}
