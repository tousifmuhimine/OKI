import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE_NAME = "oki_auth_session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasSessionCookie = Boolean(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  redirect(hasSessionCookie ? "/dashboard" : "/auth/login");
}
