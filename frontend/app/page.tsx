import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE_NAME = "oki_auth_session";
const AUTH_COOKIE_VALUE = "supabase";

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasSessionCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;
  redirect(hasSessionCookie ? "/dashboard" : "/auth/login");
}
