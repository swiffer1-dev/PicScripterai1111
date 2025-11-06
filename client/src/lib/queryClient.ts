import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Feature flag for cookie-based auth (enabled by default to fix 401 errors)
const FEATURE_TOKEN_REFRESH = import.meta.env.VITE_FEATURE_TOKEN_REFRESH !== "false";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Fetch with automatic token refresh on 401
 * Retries the request once after refreshing the access token
 */
async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // If feature is disabled, use regular fetch
  if (!FEATURE_TOKEN_REFRESH) {
    return fetch(input, init);
  }

  // Make initial request with credentials
  const res = await fetch(input, { 
    ...init, 
    credentials: "include" 
  });
  
  // If not 401, return response
  if (res.status !== 401) {
    return res;
  }
  
  // Try to refresh token
  try {
    const refreshed = await fetch("/api/auth/refresh", { 
      method: "POST", 
      credentials: "include" 
    });
    
    if (!refreshed.ok) {
      // Refresh failed - user needs to re-authenticate
      throw new Error("AUTH_REAUTH_REQUIRED");
    }
    
    // Retry original request with new token
    return fetch(input, { 
      ...init, 
      credentials: "include" 
    });
  } catch (error: any) {
    if (error.message === "AUTH_REAUTH_REQUIRED") {
      // Clear local storage and redirect to login
      localStorage.removeItem("token");
      window.location.href = "/login";
      throw error;
    }
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await apiFetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {};
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const res = await apiFetch(queryKey.join("/") as string, {
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
