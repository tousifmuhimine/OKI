"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Check, CreditCard, Sparkles, AlertCircle, Clock, 
  HelpCircle, ShieldCheck, MessageSquare, Zap, Layers,
  Cable, Shield, Settings2
} from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";

type OrganizationBilling = {
  id: string;
  company_name: string;
  plan_name: string;
  subscription_status: string;
  subscription_cycle: string;
  subscription_expires_at: string | null;
  chatbot_enabled: boolean;
  crm_enabled: boolean;
  lead_bulk_share_enabled: boolean;
  
  requested_plan_name: string | null;
  requested_subscription_cycle: string | null;
  requested_at: string | null;
};

const PLAN_DETAILS = {
  free: {
    name: "Free Trial",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      { text: "Full CRM Lead Management", enabled: true },
      { text: "Basic Activity Timeline", enabled: true },
      { text: "Single Link Bulk Share", enabled: false },
      { text: "AI Automated Chatbot replies", enabled: false },
      { text: "Custom Integrations", enabled: false },
    ],
    gradient: "from-slate-500 to-slate-700",
  },
  basic: {
    name: "Basic CRM",
    priceMonthly: 29,
    priceYearly: 290,
    features: [
      { text: "Full CRM Lead Management", enabled: true },
      { text: "Basic Activity Timeline", enabled: true },
      { text: "Single Link Bulk Share", enabled: false },
      { text: "AI Automated Chatbot replies", enabled: false },
      { text: "Custom Integrations", enabled: false },
    ],
    gradient: "from-blue-500 to-indigo-600",
  },
  premium: {
    name: "Premium Pro",
    priceMonthly: 99,
    priceYearly: 990,
    features: [
      { text: "Full CRM Lead Management", enabled: true },
      { text: "Advanced Activity Timeline & SLAs", enabled: true },
      { text: "Single Link Bulk Share", enabled: true },
      { text: "AI Automated Chatbot replies (Groq)", enabled: true },
      { text: "Standard Integrations (WhatsApp, Messenger)", enabled: true },
    ],
    gradient: "from-violet-600 to-indigo-700",
    popular: true,
  },
  enterprise: {
    name: "Enterprise Max",
    priceMonthly: 299,
    priceYearly: 2990,
    features: [
      { text: "Full CRM Lead Management", enabled: true },
      { text: "Advanced Activity Timeline & SLAs", enabled: true },
      { text: "Single Link Bulk Share", enabled: true },
      { text: "AI Automated Chatbot replies (Groq)", enabled: true },
      { text: "Custom Enterprise Integrations", enabled: true },
      { text: "Dedicated Support Specialist", enabled: true },
    ],
    gradient: "from-amber-500 to-rose-600",
  },
};

export default function BillingPage() {
  const [org, setOrg] = useState<OrganizationBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Billing cycle selection: monthly vs yearly
  const [isYearly, setIsYearly] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Confirmation Modal
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  async function loadBillingData() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<OrganizationBilling>("/organizations/me/billing");
      setOrg(data);
      if (data.subscription_cycle === "yearly") {
        setIsYearly(true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBillingData();
  }, []);

  async function handlePlanRequest(planKey: string) {
    setSubmitting(planKey);
    setSuccessMessage(null);
    setError(null);
    try {
      const cycle = isYearly ? "yearly" : "monthly";
      const updatedOrg = await apiRequest<OrganizationBilling>("/organizations/me/billing/request-plan", {
        method: "POST",
        body: JSON.stringify({
          plan_name: planKey,
          subscription_cycle: cycle
        })
      });
      setOrg(updatedOrg);
      setSuccessMessage(`Successfully requested the ${PLAN_DETAILS[planKey as keyof typeof PLAN_DETAILS].name} package! A website manager will review your request shortly.`);
      setCheckoutPlan(null);
    } catch (err: any) {
      setError(err.message || "Failed to submit plan request");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-400 font-medium">Loading subscription configuration...</p>
        </div>
      </div>
    );
  }

  const currentPlanKey = (org?.plan_name || "free") as keyof typeof PLAN_DETAILS;
  const currentPlan = PLAN_DETAILS[currentPlanKey] || PLAN_DETAILS.free;

  const pathname = usePathname();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 text-slate-800 dark:text-slate-100 font-sans">
      
      {/* Navigation Tabs */}
      <div className="mb-6 flex items-center gap-2 border-b border-white/20 dark:border-white/10 overflow-x-auto whitespace-nowrap scrollbar-none">
        <Link href="/dashboard/settings/channels" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
          <Cable size={16} /> Channels
        </Link>
        <Link href="/dashboard/settings/ai" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
          <Zap size={16} /> AI & Automation
        </Link>
        <Link href="/dashboard/settings/permissions" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
          <Shield size={16} /> Permissions
        </Link>
        <Link href="/dashboard/settings/crm" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
          <Settings2 size={16} /> CRM Configuration
        </Link>
        <Link href="/dashboard/settings/billing" className="flex items-center gap-2 border-b-2 border-brand-500 px-4 py-3 text-sm font-medium text-brand-600 transition dark:text-brand-400">
          <CreditCard size={16} /> Billing & Plan
        </Link>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing & Subscriptions</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your CRM organization subscription plans, request upgrades, and monitor system features.</p>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400 flex items-center gap-3">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-3">
          <ShieldCheck size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {org?.requested_plan_name && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex gap-3">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400">Plan Upgrade Request Pending Approval</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Your request to change to <strong className="capitalize">{org.requested_plan_name}</strong> ({org.requested_subscription_cycle}) was submitted on {new Date(org.requested_at!).toLocaleDateString()}. CRM managers will activate your features shortly.
              </p>
            </div>
          </div>
          <span className="rounded-lg bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            Awaiting Staff Review
          </span>
        </div>
      )}

      {/* Grid: Current subscription & Feature Toggles */}
      <div className="grid gap-6 md:grid-cols-3">
        
        {/* Current Subscription Card */}
        <div className="md:col-span-1 rounded-2xl border border-white/20 bg-white/40 dark:bg-slate-900/40 p-6 backdrop-blur-xl space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Current Plan</span>
            <div>
              <h2 className="text-xl font-bold capitalize">{currentPlan.name}</h2>
              <p className="text-xs text-slate-500 mt-1">
                Cycle: <span className="capitalize font-semibold">{org?.subscription_cycle}</span>
              </p>
            </div>
            
            <div className="h-px bg-slate-200 dark:bg-white/10" />

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Status</span>
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-600 dark:text-emerald-400 capitalize">
                  {org?.subscription_status}
                </span>
              </div>
              {org?.subscription_expires_at && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Expires At</span>
                  <span className="font-semibold">{new Date(org.subscription_expires_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4">
            <span className="text-[10px] text-slate-400 flex items-center gap-1.5 leading-relaxed">
              <ShieldCheck size={12} className="text-indigo-400 shrink-0" />
              <span>Payments are handled manually by CRM administrators. Request an upgrade below to get started.</span>
            </span>
          </div>
        </div>

        {/* Feature Switches list */}
        <div className="md:col-span-2 rounded-2xl border border-white/20 bg-white/40 dark:bg-slate-900/40 p-6 backdrop-blur-xl space-y-6">
          <div>
            <h3 className="text-sm font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Active System Modules</h3>
            <p className="text-xs text-slate-500 mt-0.5">Below are the modules enabled for your organization based on the active plan.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* CRM Module */}
            <div className={`rounded-xl border p-4 space-y-3 transition ${org?.crm_enabled ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-slate-200 dark:border-white/10 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <Layers size={18} className="text-indigo-500" />
                <span className={`h-2 w-2 rounded-full ${org?.crm_enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              </div>
              <div>
                <h4 className="text-xs font-bold">CRM Core Workspace</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Leads, pipelines, customers, and data tables access.</p>
              </div>
            </div>

            {/* Chatbot Module */}
            <div className={`rounded-xl border p-4 space-y-3 transition ${org?.chatbot_enabled ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-slate-200 dark:border-white/10 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <MessageSquare size={18} className="text-indigo-500" />
                <span className={`h-2 w-2 rounded-full ${org?.chatbot_enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              </div>
              <div>
                <h4 className="text-xs font-bold">AI Chatbot System</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Automated replies for WhatsApp and Messenger channels.</p>
              </div>
            </div>

            {/* Bulk Share Module */}
            <div className={`rounded-xl border p-4 space-y-3 transition ${org?.lead_bulk_share_enabled ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-slate-200 dark:border-white/10 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <Zap size={18} className="text-indigo-500" />
                <span className={`h-2 w-2 rounded-full ${org?.lead_bulk_share_enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              </div>
              <div>
                <h4 className="text-xs font-bold">Bulk Lead Sharing</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Generate single-link shared workspaces for multiple leads.</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Upgrade pricing plans */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
          <div>
            <h3 className="text-lg font-bold">Choose Subscription Package</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Select a plan suited for your team size and chatbot automation needs.</p>
          </div>
          
          {/* Cycle Toggle */}
          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl self-start sm:self-auto">
            <button 
              onClick={() => setIsYearly(false)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${!isYearly ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setIsYearly(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${isYearly ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span>Yearly</span>
              <span className="rounded bg-indigo-500/10 px-1 py-0.5 text-[9px] font-bold text-indigo-500">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid gap-6 md:grid-cols-4">
          {Object.entries(PLAN_DETAILS).map(([planKey, details]) => {
            const isCurrent = currentPlanKey === planKey;
            const isPending = org?.requested_plan_name === planKey;
            
            const price = isYearly ? details.priceYearly : details.priceMonthly;
            const cycleText = isYearly ? "/yr" : "/mo";

            return (
              <div 
                key={planKey}
                className={`rounded-2xl border relative flex flex-col justify-between p-6 backdrop-blur-md transition-all ${
                  isCurrent 
                    ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-500/5 ring-1 ring-indigo-500/10' 
                    : details.popular 
                    ? 'border-slate-300 dark:border-white/20 bg-white/20 dark:bg-slate-900/20 scale-100 hover:scale-[1.01]'
                    : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                {details.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 px-3 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase shadow-sm">
                    Most Popular
                  </span>
                )}
                
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase shadow-sm">
                    Active Plan
                  </span>
                )}

                <div className="space-y-5">
                  {/* Name and Price */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 capitalize">{details.name}</h4>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold tracking-tight">${price}</span>
                      <span className="text-xs text-slate-500 font-medium">{cycleText}</span>
                    </div>
                  </div>

                  <div className="h-px bg-slate-200 dark:bg-white/10" />

                  {/* Features List */}
                  <ul className="space-y-3">
                    {details.features.map((f, idx) => (
                      <li key={idx} className={`flex items-start gap-2.5 text-xs ${f.enabled ? '' : 'text-slate-400 dark:text-slate-500 line-through'}`}>
                        <Check size={14} className={`shrink-0 mt-0.5 ${f.enabled ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600'}`} />
                        <span>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  {isCurrent ? (
                    <button 
                      disabled
                      className="w-full h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-wider"
                    >
                      Currently Active
                    </button>
                  ) : isPending ? (
                    <button 
                      disabled
                      className="w-full h-10 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                    >
                      <Clock size={12} />
                      <span>Pending Approval</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setCheckoutPlan(planKey)}
                      disabled={!!org?.requested_plan_name}
                      className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-xs font-bold text-white shadow-md transition hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles size={12} />
                      <span>Request {details.name}</span>
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Checkout Modal (Upgrade Simulation) */}
      {checkoutPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <CreditCard className="text-indigo-500" size={20} />
                <span>Plan Upgrade Request</span>
              </h3>
              <button 
                onClick={() => setCheckoutPlan(null)} 
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Confirm your request to change your organization subscription to the following tier:
              </p>
              
              <div className="rounded-xl bg-slate-500/5 p-4 border border-slate-200 dark:border-white/5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Target Plan</span>
                  <span className="text-sm font-bold capitalize text-indigo-500 dark:text-indigo-400">
                    {PLAN_DETAILS[checkoutPlan as keyof typeof PLAN_DETAILS].name}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 dark:border-white/5 pt-2">
                  <span className="text-xs text-slate-500">Billing Cycle</span>
                  <span className="text-sm font-bold capitalize">
                    {isYearly ? "Yearly (20% Off)" : "Monthly"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 dark:border-white/5 pt-2">
                  <span className="text-xs text-slate-500 font-semibold">Price Estimate</span>
                  <span className="text-base font-extrabold text-slate-800 dark:text-white">
                    ${isYearly ? PLAN_DETAILS[checkoutPlan as keyof typeof PLAN_DETAILS].priceYearly : PLAN_DETAILS[checkoutPlan as keyof typeof PLAN_DETAILS].priceMonthly}
                    <span className="text-xs font-normal text-slate-500">/{isYearly ? 'yr' : 'mo'}</span>
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>
                  <strong>Manual Adjustments Needed:</strong> Submitting this request notifies the CRM Website manager. A manager will manually authorize your plan features, adjust settings, and coordinate billing setup.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCheckoutPlan(null)}
                  className="flex-1 h-11 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePlanRequest(checkoutPlan)}
                  disabled={submitting === checkoutPlan}
                  className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg flex items-center justify-center gap-1.5"
                >
                  {submitting === checkoutPlan ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <span>Submit Upgrade Request</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
BillingPage.getLayout = (page: React.ReactElement) => (
  <ProtectedPage permissions={["ai.settings"]}>{page}</ProtectedPage>
);
