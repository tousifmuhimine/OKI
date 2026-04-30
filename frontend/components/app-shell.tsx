"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, Zap, ShoppingCart,
  Star, Mail, MessageSquare, Lightbulb, TrendingUp,
  BarChart2, Infinity, Sun, Moon, Search, Bell,
  LogOut, ChevronDown, Plus, Settings, HelpCircle,
} from "lucide-react";

import { clearAllAuthState, isDemoSessionActive } from "@/lib/demo-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const primaryNav = [
  { href: "/dashboard", label: "Workbench",  icon: LayoutDashboard, badge: "3" },
  { href: "/customers", label: "Customers",  icon: Users },
  { href: "/leads",     label: "OKKI Leads", icon: Zap },
  { href: "/orders",    label: "Trading",    icon: ShoppingCart },
];

const secondaryNav = [
  { label: "Favourites", icon: Star },
  { label: "Mail",       icon: Mail, href: "/dashboard/mail" },
  { label: "Talk",       icon: MessageSquare, href: "/dashboard/inbox" },
  { label: "Leads",      icon: Lightbulb, dot: true },
  { label: "Pipeline",   icon: TrendingUp },
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const isLogin  = pathname === "/login" || pathname?.startsWith("/auth");

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
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[72px] flex-col bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl border-r border-white/20 dark:border-white/10 shadow-[4px_0_32px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_32px_rgba(0,0,0,0.3)]">

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
            const active = pathname?.startsWith(item.href);
            const Icon   = item.icon;
            return (
              <Link
                key={item.href}
                id={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                href={item.href}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-xl py-3 text-[10px] font-medium transition-all ${
                  active
                    ? "bg-brand-500/20 text-brand-700 dark:bg-brand-500/30 dark:text-brand-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                    : "text-slate-600 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-500 dark:bg-brand-400" />
                )}
                <Icon size={18} strokeWidth={active ? 2 : 1.7} />
                <span className="leading-tight">{item.label}</span>
                {item.badge ? (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}

          <div className="my-2 h-px bg-slate-200/50 dark:bg-white/10" />

          {secondaryNav.slice(1).map((item) => {
            const Icon = item.icon;
            const active = item.href ? pathname?.startsWith(item.href) : false;
            const className = `relative flex flex-col items-center justify-center gap-1 rounded-xl py-3 text-[10px] transition ${
              active
                ? "bg-brand-500/20 text-brand-700 dark:bg-brand-500/30 dark:text-brand-300"
                : "text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-slate-300"
            }`;
            const content = (
              <>
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-500 dark:bg-brand-400" />
                )}
                <Icon size={16} strokeWidth={1.6} />
                <span className="max-w-[58px] text-center leading-tight">{item.label}</span>
                {item.dot && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
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
              ? "bg-brand-500/20 text-brand-700 dark:bg-brand-500/30 dark:text-brand-300"
              : "text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-slate-300"
          }`}>
            <Settings size={16} strokeWidth={1.6} />
            <span>Settings</span>
          </Link>
        </div>
      </aside>

      {/* ─── Header ──────────────────────────────────────────── */}
      <header className="fixed left-[72px] right-0 top-0 z-20 flex h-[54px] items-center justify-between border-b border-white/30 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 px-5 backdrop-blur-xl">

        {/* Search */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-8 w-full max-w-[380px] items-center gap-2 rounded-xl border border-white/50 dark:border-white/10 bg-white/50 dark:bg-black/20 px-3 text-sm text-slate-500 dark:text-slate-400 transition focus-within:border-brand-400 focus-within:bg-white/80 focus-within:ring-2 focus-within:ring-brand-400/20 dark:focus-within:border-brand-500 dark:focus-within:bg-white/10">
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
            className="mr-2 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-glow-sm transition hover:from-brand-400 hover:to-indigo-500 active:scale-95"
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

          <div className="ml-1 flex items-center gap-1.5 rounded-xl px-2 py-1 transition hover:bg-white/50 dark:hover:bg-white/10 cursor-pointer">
            <div className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-[11px] font-bold text-white shadow-glow-sm">
              AD
            </div>
            <span className="hidden text-xs font-medium text-slate-800 dark:text-slate-200 xl:block">Admin</span>
            <ChevronDown size={11} className="hidden text-slate-500 dark:text-slate-400 xl:block" />
          </div>
        </div>
      </header>

      {/* ─── Main ────────────────────────────────────────────── */}
      <main className="min-h-screen pl-[72px] pt-[54px]">{children}</main>
    </div>
  );
}
