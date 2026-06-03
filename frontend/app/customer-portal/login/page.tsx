"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function CustomerPortalLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest<{ token: string; customer: any }>("/customer-portal/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      
      localStorage.setItem("customer_portal_token", res.token);
      localStorage.setItem("customer_portal_user", JSON.stringify(res.customer));
      
      router.push("/customer-portal/dashboard");
    } catch (err) {
      setError((err as Error).message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-950 font-sans px-4">
      {/* Background Neon Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[40rem] h-[40rem] bg-pink-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Glass Card */}
      <div className="relative z-10 w-full max-w-md p-8 md:p-10 rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-2xl animate-fade-in">
        
        {/* Brand/Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 shadow-lg shadow-indigo-500/20 mb-4 animate-pulse">
            <Sparkles size={26} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Client Workspace
          </h1>
          <p className="mt-2 text-sm text-slate-400 font-medium">
            Access your timeline, counselor chat, and documents
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-sm animate-shake">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block ml-1">
              Registered Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-12 pl-12 pr-4 rounded-2xl border border-white/10 bg-white/5 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-indigo-500/50 focus:bg-white/10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block ml-1">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 pl-12 pr-4 rounded-2xl border border-white/10 bg-white/5 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-indigo-500/50 focus:bg-white/10"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-pink-500 font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* First time tip */}
        <div className="mt-8 p-4 rounded-2xl border border-indigo-500/10 bg-indigo-500/5 text-xs text-indigo-300 leading-relaxed text-center">
          <span className="font-semibold">First time logging in?</span> Use your registered phone number as your temporary password.
        </div>
      </div>
    </div>
  );
}
