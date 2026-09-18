import { QueryClient } from "@tanstack/react-query";

import { ApiRequestError } from "@/api/client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // A 4xx means the request itself was wrong; retrying cannot help.
        if (error instanceof ApiRequestError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
