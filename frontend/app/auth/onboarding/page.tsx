"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, ShoppingCart, Hammer, Home, Building2, ArrowRight, Loader2, Briefcase } from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";

type IndustryOption = {
  code: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  gradient: string;
  glow: string;
};

const industries: IndustryOption[] = [
  {
    code: "study_abroad",
    name: "Study Abroad",
    description: "Manage student applications, offers, visa processes, and counselor departments.",
    icon: GraduationCap,
    gradient: "from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-500",
    glow: "shadow-blue-500/20 dark:shadow-blue-500/10",
  },
  {
    code: "ecommerce",
    name: "E-commerce",
    description: "Track customer orders, confirmation, packaging, shipping, and return pipelines.",
    icon: ShoppingCart,
    gradient: "from-rose-500 to-orange-600 dark:from-rose-600 dark:to-orange-500",
    glow: "shadow-rose-500/20 dark:shadow-rose-500/10",
  },
  {
    code: "vendors_interior",
    name: "Vendors & Interior",
    description: "Coordinate requirements gathering, proposals, negotiations, and project milestones.",
    icon: Hammer,
    gradient: "from-amber-500 to-yellow-600 dark:from-amber-600 dark:to-yellow-500",
    glow: "shadow-amber-500/20 dark:shadow-amber-500/10",
  },
  {
    code: "real_estate",
    name: "Real Estate",
    description: "Track site visits, inquiries, customer follow-ups, and property bookings.",
    icon: Home,
    gradient: "from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-500",
    glow: "shadow-emerald-500/20 dark:shadow-emerald-500/10",
  },
];

function OnboardingContent() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCurrentOrg() {
      try {
        const org = await apiRequest<{ company_name: string; organization_type_code: string | null }>("/organizations/me");
        setCompanyName(org.company_name || "");
        if (org.organization_type_code) {
          setSelectedCode(org.organization_type_code);
        }
      } catch (err) {
        setError("Failed to fetch organization info. Please try logging in again.");
      } finally {
        setFetching(false);
      }
    }
    loadCurrentOrg();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Company Name is required.");
      return;
    }
    if (!selectedCode) {
      setError("Please select a business type.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiRequest("/organizations/me", {
        method: "PATCH",
        body: JSON.stringify({
          company_name: companyName,
          organization_type_code: selectedCode,
        }),
      });

      // Update local session storage
      if (typeof window !== "undefined") {
        sessionStorage.setItem("oki_org_type_code", selectedCode);
      }

      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white/60 px-6 py-4 shadow-card dark:border-white/10 dark:bg-slate-900/60 backdrop-blur-md">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading your profile details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl animate-scale-in">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 shadow-glow">
            <Briefcase size={22} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Configure your workspace
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Let's customize CRM pipelines, stages, and context fields for your industry type.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 sm:p-8 space-y-6">
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="company-name" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Company Name
            </label>
            <div className="relative">
              <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="company-name"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter your organization's name"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 pl-11 pr-4 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
            </div>
          </div>

          <div>
            <span className="mb-3 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Business / CRM Module Type
            </span>
            <div className="grid gap-4 sm:grid-cols-2">
              {industries.map((ind) => {
                const IconComp = ind.icon;
                const active = selectedCode === ind.code;
                return (
                  <button
                    key={ind.code}
                    type="button"
                    onClick={() => {
                      setSelectedCode(ind.code);
                      setError(null);
                    }}
                    className={`group relative flex flex-col items-start rounded-2xl border p-5 text-left transition-all ${ind.glow} ${
                      active
                        ? "border-brand-500 bg-brand-50/50 dark:border-brand-500 dark:bg-brand-500/10 shadow-glow-sm"
                        : "border-slate-200 bg-white/40 hover:border-slate-300 hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    }`}
                  >
                    <div
                      className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${ind.gradient} text-white shadow-glow-sm`}
                    >
                      <IconComp size={18} />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {ind.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {ind.description}
                    </p>
                    {active && (
                      <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-brand-500 shadow-glow" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !companyName.trim() || !selectedCode}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-sm font-semibold text-white shadow-glow transition disabled:opacity-60 cursor-pointer active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Setting up your pipelines...
              </>
            ) : (
              <>
                <span>Complete Setup</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <ProtectedPage>
      <OnboardingContent />
    </ProtectedPage>
  );
}
