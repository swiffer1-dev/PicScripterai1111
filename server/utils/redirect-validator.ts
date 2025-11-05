function getAllowedRedirectUris(): string[] {
  const allowlistEnv = process.env.OAUTH_REDIRECT_ALLOWLIST;
  
  if (!allowlistEnv) {
    const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5000";
    return [corsOrigin];
  }
  
  return allowlistEnv.split(",").map(uri => uri.trim()).filter(Boolean);
}

export function validateRedirectUri(redirectUri: string): boolean {
  const allowedUris = getAllowedRedirectUris();
  
  try {
    const targetUrl = new URL(redirectUri);
    
    return allowedUris.some(allowed => {
      const allowedUrl = new URL(allowed);
      return (
        targetUrl.protocol === allowedUrl.protocol &&
        targetUrl.host === allowedUrl.host &&
        targetUrl.pathname.startsWith(allowedUrl.pathname)
      );
    });
  } catch (error) {
    return false;
  }
}

export function getSafeRedirectUri(requestedUri?: string, defaultPath: string = "/connections"): string {
  const allowedUris = getAllowedRedirectUris();
  const baseUri = allowedUris[0];
  
  if (!requestedUri) {
    return `${baseUri}${defaultPath}`;
  }
  
  if (validateRedirectUri(requestedUri)) {
    return requestedUri;
  }
  
  return `${baseUri}${defaultPath}`;
}
