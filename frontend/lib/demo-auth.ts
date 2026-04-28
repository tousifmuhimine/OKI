export const DEMO_EMAIL = "demo@oki.local";
export const DEMO_PASSWORD = "demo1234";

const DEMO_SESSION_KEY = "oki_demo_session";
export const AUTH_COOKIE_NAME = "oki_auth_session";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function isDemoCredentials(email: string, password: string): boolean {
  return email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;
}

export function startDemoSession(): void {
  if (canUseStorage()) {
    window.localStorage.setItem(DEMO_SESSION_KEY, "active");
    document.cookie = `${AUTH_COOKIE_NAME}=demo; path=/; max-age=604800; samesite=lax`;
  }
}

export function clearDemoSession(): void {
  if (canUseStorage()) {
    window.localStorage.removeItem(DEMO_SESSION_KEY);
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  }
}

export function isDemoSessionActive(): boolean {
  return canUseStorage() && window.localStorage.getItem(DEMO_SESSION_KEY) === "active";
}

export function markBrowserAuthSession(value = "supabase"): void {
  if (typeof document !== "undefined") {
    document.cookie = `${AUTH_COOKIE_NAME}=${value}; path=/; max-age=604800; samesite=lax`;
  }
}

export function clearBrowserAuthSession(): void {
  if (typeof document !== "undefined") {
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  }
}
