import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorData;
    let errorText;
    
    try {
      // Try to parse as JSON first
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        // Clone the response before reading it as JSON to avoid stream errors
        const clone = res.clone();
        errorData = await clone.json();
        errorText = JSON.stringify(errorData);
      } else {
        errorText = await res.text();
      }
    } catch (e) {
      errorText = res.statusText;
    }
    
    // Create a custom error object that contains both the response and parsed data
    const error: any = new Error(`${res.status}: ${errorText}`);
    error.status = res.status;
    error.data = errorData;
    error.response = res;
    
    throw error;
  }
}

export async function apiRequest<T = any>(
  urlOrOptions: string | RequestInit & { url: string; data?: any },
  options?: RequestInit
): Promise<T> {
  let url: string;
  let fetchOptions: RequestInit;

  if (typeof urlOrOptions === 'string') {
    url = urlOrOptions;
    fetchOptions = options || {};
    fetchOptions.method = fetchOptions.method || 'GET';
  } else {
    url = urlOrOptions.url;
    fetchOptions = urlOrOptions;
    
    // Extract the data property if it exists and convert to JSON
    if (urlOrOptions.data) {
      const { data, ...rest } = urlOrOptions;
      fetchOptions = {
        ...rest,
        body: JSON.stringify(data),
        headers: {
          ...(urlOrOptions.headers || {}),
          'Content-Type': 'application/json'
        }
      };
    }
  }

  fetchOptions.credentials = 'include';

  try {
    const res = await fetch(url, fetchOptions);
    
    // Special case for status 403 with JSON response - this is for approval workflows
    if (res.status === 403) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        
        // Check if this is specifically an approval required response
        if (data.requiresApproval) {
          console.log("Received approval required response:", data);
          const error: any = new Error("Approval required");
          error.status = 403;
          error.data = data;
          error.config = { url };
          throw error;
        }
      }
    }
    
    // Otherwise, continue with general error handling
    await throwIfResNotOk(res);
    
    // For non-JSON responses (like DELETE which often returns no content)
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return null as T;
    }
    
    return res.json() as Promise<T>;
  } catch (error: any) {
    // Add request URL to error for better debugging
    if (!error.config) {
      error.config = { url };
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }
    
    // Special case for status 403 with JSON response - this is for approval workflows
    if (res.status === 403) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        
        // Check if this is specifically an approval required response
        if (data.requiresApproval) {
          console.log("Received approval required response:", data);
          const error: any = new Error("Approval required");
          error.status = 403;
          error.data = data;
          error.config = { url: queryKey[0] as string };
          throw error;
        }
      }
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
