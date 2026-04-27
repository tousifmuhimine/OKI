"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { isDemoSessionActive } from "@/lib/demo-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

type ProtectedPageProps = {
  children: React.ReactNode;
};

export function ProtectedPage({ children }: ProtectedPageProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    if (isDemoSessionActive()) {
      setReady(true);
      return () => {
        active = false;
      };
    }

    if (!isSupabaseConfigured()) {
      router.replace("/login");
      return () => {
        active = false;
      };
    }

    const supabase = getSupabaseClient();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) {
          return;
        }

        if (!data.session) {
          router.replace("/login");
          return;
        }

        setReady(true);
      })
      .catch(() => {
        router.replace("/login");
      });

    return () => {
      active = false;
    };
  }, [router]);

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
