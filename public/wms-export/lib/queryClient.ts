import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = any>(
  urlOrOptions: string | RequestInit & { url: string },
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
  }

  fetchOptions.credentials = 'include';

  const res = await fetch(url, fetchOptions);
  await throwIfResNotOk(res);
  
  // For non-JSON responses (like DELETE which often returns no content)
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return null as T;
  }
  
  return res.json() as Promise<T>;
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
