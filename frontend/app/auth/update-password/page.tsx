"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, RotateCcw, Check } from "lucide-react";

import { clearDemoSession, markBrowserAuthSession } from "@/lib/demo-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

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
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Password updated successfully. Logging you in...");
    
    // Clear demo sessions and mark authenticated session
    clearDemoSession();
    markBrowserAuthSession();

    setTimeout(() => {
      router.push("/dashboard");
    }, 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 shadow-glow">
            <Lock size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Create new password</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Enter your new secure account password</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card space-y-4 p-7">
          <div className="relative">
            <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/50 bg-white/50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white" placeholder="New password" />
          </div>

          <div className="relative">
            <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input required minLength={6} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-xl border border-white/50 bg-white/50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white" placeholder="Confirm new password" />
          </div>

          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">{error}</p> : null}
          {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</p> : null}

          <button disabled={loading || message !== null} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 py-2.5 font-semibold text-white shadow-glow-sm disabled:opacity-60" type="submit">
            {message ? <Check size={15} /> : <RotateCcw size={15} />}
            {loading ? "Updating..." : message ? "Updated" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
