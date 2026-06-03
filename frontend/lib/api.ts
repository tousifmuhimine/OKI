import { clearAllAuthState, getDevWorkspaceId, isDemoSessionActive } from "@/lib/demo-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

async function buildHeaders(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init);
  headers.set("Content-Type", "application/json");

  let token: string | undefined;
  if (isSupabaseConfigured()) {
    try {
      const { data } = await getSupabaseClient().auth.getSession();
      token = data.session?.access_token;
    } catch {
      clearAllAuthState();
    }
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    return headers;
  }

  if (!token) {
    // In local/dev flows we may not have a Supabase session yet.
    // Keep requests authenticated for backend dev mode via workspace header.
    headers.set("X-Dev-Workspace-Id", getDevWorkspaceId());
  }

  return headers;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await buildHeaders(options.headers);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Unable to reach the backend API. Confirm backend is running and NEXT_PUBLIC_API_BASE_URL is correct.");
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { detail?: any };
      if (payload && payload.detail) {
        if (typeof payload.detail === "string") {
          detail = payload.detail;
        } else if (Array.isArray(payload.detail)) {
          detail = payload.detail.map((err: any) => {
            const field = err.loc && err.loc.length > 1 ? err.loc.slice(1).join(".") : "";
            return field ? `${field}: ${err.msg}` : err.msg;
          }).join(", ");
        } else {
          detail = JSON.stringify(payload.detail);
        }
      }
    } catch {
      try {
        const text = await response.text();
        if (text) {
          // Truncate long bodies to keep messages readable
          detail = `${detail}: ${text.slice(0, 1000)}`;
        }
      } catch {
        // Ignore reading body failures
      }
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
