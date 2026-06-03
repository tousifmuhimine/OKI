"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { clearAllAuthState, isDemoSessionActive } from "@/lib/demo-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { apiRequest } from "@/lib/api";

type ProtectedPageProps = {
  children: React.ReactNode;
};

export function ProtectedPage({ children }: ProtectedPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    if (isDemoSessionActive()) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("oki_org_type_code", "study_abroad");
      }
      setReady(true);
      return () => {
        active = false;
      };
    }

    if (!isSupabaseConfigured()) {
      router.replace("/auth/login");
      return () => {
        active = false;
      };
    }

    const supabase = getSupabaseClient();

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) {
          return;
        }

        if (!data.session) {
          router.replace("/auth/login");
          return;
        }

        // Verify organization onboarding
        if (typeof window !== "undefined") {
          const cachedType = sessionStorage.getItem("oki_org_type_code");
          if (cachedType) {
            if (cachedType === "null" && pathname !== "/auth/onboarding") {
              router.replace("/auth/onboarding");
              return;
            }
            setReady(true);
            return;
          }
        }

        // Not cached, fetch from backend
        try {
          const org = await apiRequest<{ organization_type_code: string | null }>("/organizations/me");
          if (typeof window !== "undefined") {
            sessionStorage.setItem("oki_org_type_code", org.organization_type_code || "null");
            if (!org.organization_type_code && pathname !== "/auth/onboarding") {
              router.replace("/auth/onboarding");
              return;
            }
          }
          setReady(true);
        } catch (err) {
          // If we fail to fetch org, redirect to login
          clearAllAuthState();
          router.replace("/auth/login");
        }
      })
      .catch(() => {
        clearAllAuthState();
        router.replace("/auth/login");
      });

    return () => {
      active = false;
    };
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-[calc(100vh-54px)] items-center justify-center bg-surface-muted dark:bg-[#0b0f1a]">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-card dark:border-slate-700/60 dark:bg-slate-800/80">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Checking your session…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
