"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, LogIn, Sparkles } from "lucide-react";

import { DEMO_EMAIL, DEMO_PASSWORD, isDemoCredentials, startDemoSession } from "@/lib/demo-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null);
    if (isDemoCredentials(email, password)) { startDemoSession(); router.push("/dashboard"); return; }
    if (!isSupabaseConfigured()) { setLoading(false); setError(`Use demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`); return; }
    const { error: err } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-scale-in">

        {/* Logo mark */}
        <div className="mb-8 text-center drop-shadow-md">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] shadow-[0_0_20px_rgba(79,70,229,0.4)]">
            <span className="text-[15px] font-black tracking-widest text-white">OKI</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
            Sign in to OKKI CRM
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 drop-shadow-sm">Your daily B2B command centre</p>
        </div>

        <div className="glass-card p-7">

          {/* Demo hint */}
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-white/30 bg-white/40 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5 backdrop-blur-md">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400 drop-shadow-sm" />
            <span className="text-slate-700 dark:text-slate-200">
              Demo:{" "}
              <span className="font-semibold text-brand-700 dark:text-brand-300">{DEMO_EMAIL}</span>
              {" / "}
              <span className="font-semibold text-brand-700 dark:text-brand-300">{DEMO_PASSWORD}</span>
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400 drop-shadow-sm" htmlFor="email">
                Email address
              </label>
              <div className="relative">
                <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <input
                  id="email" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/50 bg-white/50 dark:border-white/10 dark:bg-black/20 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white/80 focus:ring-2 focus:ring-brand-400/20 dark:text-white dark:focus:border-brand-500 dark:focus:bg-white/10"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400 drop-shadow-sm" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <input
                  id="password" type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/50 bg-white/50 dark:border-white/10 dark:bg-black/20 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white/80 focus:ring-2 focus:ring-brand-400/20 dark:text-white dark:focus:border-brand-500 dark:focus:bg-white/10"
                  placeholder="Password"
                />
              </div>
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 backdrop-blur-md">
                {error}
              </p>
            ) : null}

            <button
              id="login-submit" type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 py-2.5 font-semibold text-white shadow-glow-sm transition hover:from-brand-400 hover:to-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn size={15} />
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
