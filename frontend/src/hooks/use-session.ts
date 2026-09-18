import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchSession, signInWithGoogle, signOut } from "@/api/auth";
import type { SessionState } from "@/types/api";

export const sessionKey = ["session"] as const;

export function useSession() {
  return useQuery<SessionState>({
    queryKey: sessionKey,
    queryFn: ({ signal }) => fetchSession(signal),
    // The session gates routing, so it must not be served stale after a
    // sign-in or sign-out elsewhere in the app.
    staleTime: 0,
    retry: false,
  });
}

export function useGoogleSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credential: string) => signInWithGoogle(credential),
    onSuccess: (session) => {
      queryClient.setQueryData(sessionKey, session);
      // A different account may be signing in, so nothing cached from the
      // previous one can be trusted.
      queryClient.removeQueries({ queryKey: ["activities"] });
      queryClient.removeQueries({ queryKey: ["activity-stats"] });
      queryClient.removeQueries({ queryKey: ["categories"] });
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      // Drop every account-scoped cache before re-reading the session, so no
      // previous account's rows can flash on screen.
      queryClient.clear();
      await queryClient.fetchQuery({
        queryKey: sessionKey,
        queryFn: () => fetchSession(),
      });
    },
  });
}
