"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Lock, LogIn, Mail, Sparkles } from "lucide-react";

import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  clearDemoSession,
  isDemoCredentials,
  markBrowserAuthSession,
  startDemoSession,
} from "@/lib/demo-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export default function AuthLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goToDashboard() {
    window.location.assign("/dashboard");
  }

  function handleDemoLogin() {
    setError(null);
    startDemoSession();
    goToDashboard();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim();

    if (isDemoCredentials(normalizedEmail, password)) {
      startDemoSession();
      goToDashboard();
      return;
    }

    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError(`Use demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
      return;
    }

    try {
      const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      clearDemoSession();
      markBrowserAuthSession();
      goToDashboard();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="mb-8 text-center drop-shadow-md">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 shadow-glow">
            <span className="text-[15px] font-black tracking-widest text-white">OKI</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Sign in to OKI CRM</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Your daily B2B command centre</p>
        </div>

        <div className="glass-card p-7">
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-white/30 bg-white/40 px-4 py-3 text-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" />
            <span className="text-slate-700 dark:text-slate-200">
              Demo: <span className="font-semibold text-brand-700 dark:text-brand-300">{DEMO_EMAIL}</span> /{" "}
              <span className="font-semibold text-brand-700 dark:text-brand-300">{DEMO_PASSWORD}</span>
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400" htmlFor="email">
                Email address
              </label>
              <div className="relative">
                <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-white/50 bg-white/50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white/80 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-brand-500 dark:focus:bg-white/10"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-white/50 bg-white/50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white/80 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-brand-500 dark:focus:bg-white/10"
                  placeholder="Password"
                />
              </div>
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5 text-sm text-rose-700 backdrop-blur-md dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 py-2.5 font-semibold text-white shadow-glow-sm transition hover:from-brand-400 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
              <LogIn size={15} />
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <button type="button" onClick={handleDemoLogin} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white/60 py-2.5 font-semibold text-brand-700 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-400/20 dark:bg-white/10 dark:text-brand-200 dark:hover:bg-white/15">
              <Sparkles size={15} />
              Continue with demo
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link className="font-medium text-brand-600 hover:underline dark:text-brand-300" href="/auth/signup">Create account</Link>
            <Link className="font-medium text-brand-600 hover:underline dark:text-brand-300" href="/auth/forgot-password">Forgot password?</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
