"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, UserPlus, UserRound } from "lucide-react";

import { markBrowserAuthSession } from "@/lib/demo-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured");
      return;
    }

    setLoading(true);
    const supabase = getSupabaseClient();
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (signupError) {
      setLoading(false);
      setError(signupError.message);
      return;
    }

    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setLoading(false);
        setError(signInError.message);
        return;
      }
    }

    setLoading(false);

    markBrowserAuthSession();
    router.push("/dashboard/settings/channels");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 shadow-glow">
            <UserPlus size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Create your OKI workspace</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Set up your first inbox after signup</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card space-y-4 p-7">
          <div className="relative">
            <UserRound size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-white/50 bg-white/50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white" placeholder="Your name" />
          </div>
          <div className="relative">
            <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-white/50 bg-white/50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white" placeholder="Email address" />
          </div>
          <div className="relative">
            <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/50 bg-white/50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white" placeholder="Password" />
          </div>
          <div className="relative">
            <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input required minLength={6} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-xl border border-white/50 bg-white/50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white" placeholder="Confirm password" />
          </div>

          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">{error}</p> : null}

          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 py-2.5 font-semibold text-white shadow-glow-sm disabled:opacity-60" type="submit">
            <UserPlus size={15} />
            {loading ? "Creating..." : "Create account"}
          </button>
          <p className="text-center text-sm text-slate-600 dark:text-slate-300">
            Already have an account? <Link href="/auth/login" className="font-medium text-brand-600 hover:underline dark:text-brand-300">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
