"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, UserPlus, UserRound, Building2, Briefcase, ChevronDown } from "lucide-react";

import { clearDemoSession, markBrowserAuthSession } from "@/lib/demo-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const industries = [
  { code: "study_abroad", name: "Study Abroad", description: "Counselors, application, visa & ticket tracking" },
  { code: "ecommerce", name: "E-commerce", description: "Orders, packaging, shipping & return pipeline" },
  { code: "vendors_interior", name: "Vendors & Interior", description: "Requirements, proposals & project milestones" },
  { code: "real_estate", name: "Real Estate", description: "Site visits, inquiries & property bookings" },
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [orgTypeCode, setOrgTypeCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!orgTypeCode) {
      setError("Please select an organization type");
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
      options: { 
        data: { 
          name,
          company_name: companyName,
          org_type_code: orgTypeCode,
          role: "super_admin"
        } 
      },
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

    clearDemoSession();
    markBrowserAuthSession();
    if (typeof window !== "undefined") {
      sessionStorage.setItem("oki_org_type_code", orgTypeCode);
    }
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 shadow-glow">
            <UserPlus size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Create your OKI workspace</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Set up your workspace type and company name</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card space-y-4 p-7">
          <div className="relative">
            <UserRound size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-white/50 bg-white/50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white" placeholder="Your name" />
          </div>

          <div className="relative">
            <Building2 size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="w-full rounded-xl border border-white/50 bg-white/50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white" placeholder="Company name" />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="h-[38px] w-full flex items-center justify-between rounded-xl border border-white/50 bg-white/50 px-3.5 py-2 text-left text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-200"
            >
              <span className="flex items-center gap-2.5">
                <Briefcase size={13} className="text-slate-500 shrink-0" />
                <span className={`truncate ${!orgTypeCode ? 'text-slate-400' : 'font-semibold'}`}>
                  {industries.find(ind => ind.code === orgTypeCode)?.name || "Select business type"}
                </span>
              </span>
              <ChevronDown size={14} className={`text-brand-500/60 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-10 animate-fade-in" onClick={() => setDropdownOpen(false)} />
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-white/20 bg-white/95 p-1 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/95 animate-scale-in">
                  {industries.map((ind) => (
                    <button
                      key={ind.code}
                      type="button"
                      onClick={() => {
                        setOrgTypeCode(ind.code);
                        setDropdownOpen(false);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition-all hover:bg-brand-500 hover:text-white ${
                        orgTypeCode === ind.code
                          ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <div className="font-bold">{ind.name}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{ind.description}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
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
