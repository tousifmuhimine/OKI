import { clearAllAuthState, getDevWorkspaceId, isDemoSessionActive } from "@/lib/demo-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

async function buildHeaders(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init);
  headers.set("Content-Type", "application/json");

  if (isDemoSessionActive() || !isSupabaseConfigured()) {
    headers.set("X-Dev-Workspace-Id", getDevWorkspaceId());
    return headers;
  }

  let data;
  try {
    ({ data } = await getSupabaseClient().auth.getSession());
  } catch {
    clearAllAuthState();
    return headers;
  }
  const token = data.session?.access_token;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_API_BASE_URL in frontend/.env.local");
  }

  const headers = await buildHeaders(options.headers);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Ignore non-JSON error body.
    }
    if (response.status === 401 && typeof window !== "undefined") {
      clearAllAuthState();
      await getSupabaseClient().auth.signOut().catch(() => undefined);
      window.location.assign(`/auth/login?reason=${encodeURIComponent(detail)}`);
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
