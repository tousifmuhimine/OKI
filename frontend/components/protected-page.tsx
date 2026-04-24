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
    return <p className="rounded-lg bg-white/80 p-4 text-sm text-slate-600">Checking your session...</p>;
  }

  return <>{children}</>;
}
