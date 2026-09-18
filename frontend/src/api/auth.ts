import { request } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { SessionState } from "@/types/api";

export function fetchSession(signal?: AbortSignal): Promise<SessionState> {
  return request<SessionState>(endpoints.session, { signal });
}

export function signInWithGoogle(credential: string): Promise<SessionState> {
  return request<SessionState>(endpoints.googleSignIn, {
    method: "POST",
    body: { credential },
  });
}

export function signOut(): Promise<void> {
  return request<void>(endpoints.logout, { method: "POST" });
}
