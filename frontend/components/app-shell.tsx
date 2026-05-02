"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, Zap, ShoppingCart,
  Star, Mail, MessageSquare, Lightbulb, TrendingUp,
  BarChart2, Infinity, Sun, Moon, Search, Bell,
  LogOut, ChevronDown, Plus, Settings, HelpCircle, PanelLeft, X,
  Building2, User, FileText, ArrowRight, Loader2,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

import { clearAllAuthState, isDemoSessionActive } from "@/lib/demo-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const primaryNav = [
  { href: "/dashboard", label: "Workbench",  icon: LayoutDashboard, badge: "3" },
  { href: "/customers", label: "Customers",  icon: Users },
  { href: "/leads",     label: "OKKI Leads", icon: Zap },
  { href: "/orders",    label: "Trading",    icon: ShoppingCart },
];

const mobileNav = [
  { href: "/dashboard", label: "Workbench", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/dashboard/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/leads", label: "Leads", icon: Zap },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
];

const secondaryNav = [
  { label: "Favourites", icon: Star },
  { label: "Mail",       icon: Mail, href: "/dashboard/mail" },
  { label: "Talk",       icon: MessageSquare, href: "/dashboard/inbox" },
  { label: "Leads",      icon: Lightbulb, href: "/leads", dot: true },
  { label: "Pipeline",   icon: TrendingUp, href: "/pipeline" },
  { label: "Team Data",  icon: BarChart2 },
  { label: "Synergy",    icon: Infinity },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="h-8 w-8" />;
  return (
    <button
      id="theme-toggle"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-brand-50 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-brand-300"
      type="button"
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

function isRouteActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const isLogin  = pathname === "/login" || pathname?.startsWith("/auth");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickNewOpen, setQuickNewOpen] = useState(false);

  // QuickNew form state
  const [qnCompany, setQnCompany] = useState("");
  const [qnContact, setQnContact] = useState("");
  const [qnType, setQnType] = useState<"lead" | "customer">("lead");
  const [qnSaving, setQnSaving] = useState(false);
  const [qnError, setQnError] = useState<string | null>(null);
  const [qnSuccess, setQnSuccess] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  async function signOut() {
    clearAllAuthState();
    if (!isDemoSessionActive() && isSupabaseConfigured()) {
      await getSupabaseClient().auth.signOut().catch(() => undefined);
    }
    router.push("/auth/login");
  }

  if (isLogin) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-6">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100">

      {/* ─── Sidebar ─────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl border-r border-white/20 dark:border-white/10 shadow-[4px_0_32px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_32px_rgba(0,0,0,0.3)] lg:flex">

        {/* Logo */}
        <Link
          href="/dashboard"
          id="sidebar-logo"
          className="group flex h-[54px] items-center justify-center"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow-sm transition group-hover:shadow-glow">
            <span className="text-[13px] font-black tracking-widest text-white">OKI</span>
          </div>
        </Link>

        {/* Primary nav */}
        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
          {primaryNav.map((item) => {
            const active = isRouteActive(pathname, item.href);
            const Icon   = item.icon;
            return (
              <Link
                key={item.href}
                id={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                href={item.href}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-xl py-3 text-[10px] font-medium transition-all ${
                  active
                    ? "bg-slate-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:bg-white/14 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                    : "text-slate-600 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-amber-400 dark:bg-amber-300" />
                )}
                <Icon size={18} strokeWidth={active ? 2 : 1.7} />
                <span className="leading-tight">{item.label}</span>
                {item.badge ? (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-slate-900 shadow-[0_0_10px_rgba(251,191,36,0.35)]">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}

          <div className="my-2 h-px bg-slate-200/50 dark:bg-white/10" />

          {secondaryNav.slice(1).map((item) => {
            const Icon = item.icon;
            const active = item.href ? isRouteActive(pathname, item.href) : false;
            const className = `relative flex flex-col items-center justify-center gap-1 rounded-xl py-3 text-[10px] transition ${
              active
                ? "bg-slate-900/8 text-slate-900 dark:bg-white/12 dark:text-white"
                : "text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-slate-300"
            }`;
            const content = (
              <>
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-amber-400 dark:bg-amber-300" />
                )}
                <Icon size={16} strokeWidth={1.6} />
                <span className="max-w-[58px] text-center leading-tight">{item.label}</span>
                {item.dot && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />}
              </>
            );
            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className={className}
              >
                {content}
              </Link>
            ) : (
              <div key={item.label} className={`${className} cursor-pointer`}>
                {content}
              </div>
            );
          })}
        </div>

        {/* Bottom */}
        <div className="space-y-0.5 border-t border-slate-200/50 dark:border-white/10 px-2 py-3">
          <div className="flex flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-slate-300 transition cursor-pointer">
            <HelpCircle size={16} strokeWidth={1.6} />
            <span>Help</span>
          </div>
          <Link href="/dashboard/settings/channels" className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] transition ${
            pathname?.startsWith("/dashboard/settings")
              ? "bg-slate-900/8 text-slate-900 dark:bg-white/12 dark:text-white"
              : "text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-slate-300"
          }`}>
            <Settings size={16} strokeWidth={1.6} />
            <span>Settings</span>
          </Link>
        </div>
      </aside>

      {/* ─── Header ──────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-[54px] items-center justify-between border-b border-white/30 dark:border-white/10 bg-white/55 dark:bg-slate-900/55 px-3 backdrop-blur-xl sm:px-5 lg:left-[72px]">

        {/* Search */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10 lg:hidden"
          >
            <PanelLeft size={18} />
          </button>
          <Link
            href="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-[12px] font-black tracking-widest text-white shadow-glow-sm lg:hidden"
          >
            OKI
          </Link>
          <div className="hidden h-9 w-full max-w-[240px] items-center gap-2 rounded-xl border border-white/50 dark:border-white/10 bg-white/50 dark:bg-black/20 px-3 text-sm text-slate-500 dark:text-slate-400 transition focus-within:border-brand-400 focus-within:bg-white/80 focus-within:ring-2 focus-within:ring-brand-400/20 dark:focus-within:border-brand-500 dark:focus-within:bg-white/10 sm:flex sm:max-w-[380px]">
            <Search size={13} className="shrink-0" />
            <input
              id="global-search"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="Search customers, deals…"
              type="search"
            />
            <kbd className="hidden shrink-0 rounded-md border border-slate-300/50 bg-white/50 px-1.5 text-[10px] text-slate-400 dark:border-white/10 dark:bg-black/40 sm:block">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1">
          <button
            id="header-new-btn"
            type="button"
            onClick={() => { setQnCompany(""); setQnContact(""); setQnType("lead"); setQnError(null); setQnSuccess(false); setQuickNewOpen(true); }}
            className="mr-1 hidden h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-3 text-sm font-semibold text-white shadow-glow-sm transition hover:from-brand-400 hover:to-indigo-500 active:scale-95 sm:flex sm:mr-2 sm:px-3.5"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">New</span>
          </button>

          <button
            id="header-notifications"
            type="button"
            aria-label="Notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-brand-50 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-brand-300"
          >
            <Bell size={15} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
          </button>

          <ThemeToggle />

          <button
            id="header-signout"
            type="button"
            aria-label="Sign out"
            onClick={signOut}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-brand-50 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-brand-300"
          >
            <LogOut size={14} />
          </button>

          <div className="ml-1 hidden items-center gap-1.5 rounded-xl px-2 py-1 transition hover:bg-white/50 dark:hover:bg-white/10 cursor-pointer sm:flex">
            <div className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-[11px] font-bold text-white shadow-glow-sm">
              AD
            </div>
            <span className="hidden text-xs font-medium text-slate-800 dark:text-slate-200 xl:block">Admin</span>
            <ChevronDown size={11} className="hidden text-slate-500 dark:text-slate-400 xl:block" />
          </div>
        </div>
      </header>

      {/* ─── Main ────────────────────────────────────────────── */}
      <main className="min-h-screen pt-[54px] pb-[calc(72px+env(safe-area-inset-bottom))] lg:pl-[72px] lg:pb-0">{children}</main>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
          />
          <aside
            aria-label="Mobile navigation"
            className="absolute inset-y-0 left-0 flex w-[288px] max-w-[86vw] flex-col border-r border-slate-800/80 bg-slate-950/96 px-4 pb-4 pt-3 text-slate-100 shadow-[20px_0_50px_rgba(2,6,23,0.45)] backdrop-blur-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <Link
                href="/dashboard"
                className="flex h-11 items-center gap-3 rounded-xl px-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-[12px] font-black tracking-widest text-white shadow-glow-sm">
                  OKI
                </div>
                <span className="text-sm font-semibold text-slate-100">Workspace</span>
              </Link>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1 overflow-y-auto">
              {primaryNav.map((item) => {
                const active = isRouteActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition ${
                      active
                          ? "bg-brand-500 text-white shadow-glow-sm"
                          : "text-slate-200 hover:bg-white/10"
                    }`}
                  >
                    <Icon size={18} />
                    <span className="flex-1">{item.label}</span>
                      {item.badge ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-amber-400/25 text-amber-300"}`}>{item.badge}</span> : null}
                  </Link>
                );
              })}

                <div className="my-3 h-px bg-slate-800/80" />

              {secondaryNav.slice(1).map((item) => {
                const active = item.href ? isRouteActive(pathname, item.href) : false;
                const Icon = item.icon;
                const content = (
                  <>
                    <Icon size={18} />
                    <span className="flex-1">{item.label}</span>
                    {item.dot ? <span className="h-2 w-2 rounded-full bg-amber-400" /> : null}
                  </>
                );

                return item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition ${
                      active
                        ? "bg-white/12 text-white"
                        : "text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={item.label}
                    className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium text-slate-500"
                  >
                    {content}
                  </div>
                );
              })}
            </div>

            <div className="mt-auto border-t border-slate-800/80 pt-3">
              <div className="mb-2 flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
                <span className="text-sm font-medium text-slate-200">Theme</span>
                <ThemeToggle />
              </div>
              <Link
                href="/dashboard/settings/channels"
                onClick={() => setMobileMenuOpen(false)}
                className={`mb-2 flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition ${
                  pathname?.startsWith("/dashboard/settings")
                    ? "bg-white/12 text-white"
                    : "text-slate-300 hover:bg-white/10"
                }`}
              >
                <Settings size={18} />
                <span>Settings</span>
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-medium text-slate-300 transition hover:bg-white/10"
              >
                <LogOut size={18} />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/30 bg-white/80 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/80 lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {mobileNav.map((item) => {
            const active = isRouteActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition active:scale-95 ${
                  active
                    ? "bg-brand-500 text-white shadow-glow-sm"
                    : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ─── Quick New Modal ──────────────────────────────────── */}
      {quickNewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-fade-up">
            {qnSuccess ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/20">
                  <ArrowRight size={24} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{qnType === "lead" ? "Lead Created!" : "Customer Created!"}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{qnCompany} has been added successfully.</p>
                <div className="flex gap-3 w-full">
                  <button type="button" onClick={() => { setQuickNewOpen(false); router.push(qnType === "lead" ? "/leads" : "/customers"); }} className="flex-1 h-11 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-sm font-semibold text-white shadow-glow-sm hover:from-brand-400 hover:to-indigo-500">
                    View {qnType === "lead" ? "Leads" : "Customers"}
                  </button>
                  <button type="button" onClick={() => setQuickNewOpen(false)} className="flex-1 h-11 rounded-xl border border-slate-200 bg-white/60 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">Close</button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quick Create</h2>
                  <button onClick={() => setQuickNewOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X size={16} /></button>
                </div>
                <div className="mb-4 flex gap-2">
                  {([
                    { key: "lead" as const, label: "New Lead", Icon: Zap },
                    { key: "customer" as const, label: "New Customer", Icon: Users },
                  ]).map(opt => (
                    <button key={opt.key} type="button" onClick={() => setQnType(opt.key)}
                      className={`flex flex-1 items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${qnType === opt.key ? "border-brand-300/60 bg-brand-50/80 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300" : "border-slate-200 bg-white/40 text-slate-600 hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}>
                      <opt.Icon size={16} />{opt.label}
                    </button>
                  ))}
                </div>
                {qnError && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{qnError}</p>}
                <form onSubmit={async e => {
                  e.preventDefault();
                  if (!qnCompany.trim()) return;
                  setQnSaving(true); setQnError(null);
                  try {
                    if (qnType === "lead") {
                      await apiRequest("/leads", { method: "POST", body: JSON.stringify({ company_name: qnCompany, contact_person: qnContact || null, source: "manual", status: "new" }) });
                    } else {
                      await apiRequest("/customers", { method: "POST", body: JSON.stringify({ company_name: qnCompany, contact_person: qnContact || null, stage: "new" }) });
                    }
                    setQnSuccess(true);
                  } catch (err) { setQnError((err as Error).message); } finally { setQnSaving(false); }
                }} className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"><Building2 size={12} className="inline mr-1" />Company / Name *</label>
                    <input required value={qnCompany} onChange={e => setQnCompany(e.target.value)} placeholder={qnType === "lead" ? "Company or prospect name" : "Company name"} autoFocus
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"><User size={12} className="inline mr-1" />Contact Person</label>
                    <input value={qnContact} onChange={e => setQnContact(e.target.value)} placeholder="Full name or email"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setQuickNewOpen(false)} className="flex-1 h-11 rounded-xl border border-slate-200 bg-white/60 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">Cancel</button>
                    <button type="submit" disabled={qnSaving || !qnCompany.trim()}
                      className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-sm font-semibold text-white shadow-glow-sm hover:from-brand-400 hover:to-indigo-500 active:scale-95 disabled:opacity-60">
                      {qnSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      {qnSaving ? "Creating…" : `Create ${qnType === "lead" ? "Lead" : "Customer"}`}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
