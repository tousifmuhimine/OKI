export const DEMO_EMAIL = "demo@oki.local";
export const DEMO_PASSWORD = "demo1234";

const DEMO_SESSION_KEY = "oki_demo_session";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function isDemoCredentials(email: string, password: string): boolean {
  return email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;
}

export function startDemoSession(): void {
  if (canUseStorage()) {
    window.localStorage.setItem(DEMO_SESSION_KEY, "active");
  }
}

export function clearDemoSession(): void {
  if (canUseStorage()) {
    window.localStorage.removeItem(DEMO_SESSION_KEY);
  }
}

export function isDemoSessionActive(): boolean {
  return canUseStorage() && window.localStorage.getItem(DEMO_SESSION_KEY) === "active";
}
