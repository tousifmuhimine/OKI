import { getDevWorkspaceId } from "@/lib/demo-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function buildWebSocketUrl(path: string): Promise<string> {
  if (!API_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_API_BASE_URL in frontend/.env.local");
  }

  const baseUrl = new URL(API_BASE_URL);
  baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";

  const url = new URL(path, baseUrl);

  if (isSupabaseConfigured()) {
    try {
      const { data } = await getSupabaseClient().auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        url.searchParams.set("token", token);
        return url.toString();
      }
    } catch {
      // fall back to dev workspace id below
    }
  }

  url.searchParams.set("workspace_id", getDevWorkspaceId());
  return url.toString();
}
