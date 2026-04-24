"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { clearDemoSession, isDemoSessionActive } from "@/lib/demo-auth";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const primaryNav = [
  { href: "/dashboard", label: "Workbench", icon: "▦", badge: "3" },
  { href: "/customers", label: "Customers", icon: "◎" },
  { href: "/leads", label: "OKKI Leads", icon: "◉" },
  { href: "/orders", label: "Trading", icon: "▤" },
];

const secondaryNav = [
  { label: "Commonly used", icon: "★" },
  { label: "Mail", icon: "✉" },
  { label: "Communication", icon: "▣" },
  { label: "Clues", icon: "⌘" },
  { label: "Business opportunities", icon: "◌", dot: true },
  { label: "Team data", icon: "▥" },
  { label: "Synergy", icon: "∞" },
];

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";

  async function signOut() {
    if (isDemoSessionActive()) {
      clearDemoSession();
      router.push("/login");
      return;
    }

    if (!isSupabaseConfigured()) {
      router.push("/login");
      return;
    }

    await getSupabaseClient().auth.signOut();
    router.push("/login");
  }

  if (isLogin) {
    return <main className="min-h-screen bg-[#f4f5fb] px-4 py-6">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-[#f4f5fb] text-[#1f2430]">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[92px] flex-col bg-[#101a42] text-white shadow-[4px_0_18px_rgba(10,20,60,0.18)]">
        <Link href="/dashboard" className="flex h-[54px] items-center justify-center bg-white">
          <span className="text-[22px] font-bold tracking-[0.12em] text-[#1769ff]">OKKI</span>
        </Link>

        <div className="flex-1 space-y-1 overflow-y-auto py-5">
          {secondaryNav.slice(0, 1).map((item) => (
            <div key={item.label} className="mb-4 flex flex-col items-center gap-1 text-[11px] text-slate-300">
              <span className="text-lg text-slate-200">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}

          <div className="mx-3 mb-3 h-px bg-white/15" />

          {primaryNav.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative mx-2 flex h-[62px] flex-col items-center justify-center gap-1 rounded-md text-[11px] transition ${
                  active ? "bg-[#1167ff] text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="text-[20px] leading-none">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="absolute right-5 top-2 rounded-full bg-[#ff314f] px-1.5 text-[10px] font-semibold">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}

          {secondaryNav.slice(1).map((item) => (
            <div
              key={item.label}
              className="relative mx-2 flex h-[62px] flex-col items-center justify-center gap-1 rounded-md text-[11px] text-slate-300"
            >
              <span className="text-[19px] leading-none">{item.icon}</span>
              <span className="max-w-[76px] text-center leading-tight">{item.label}</span>
              {item.dot ? <span className="absolute right-7 top-2 h-2 w-2 rounded-full bg-[#ff314f]" /> : null}
            </div>
          ))}
        </div>
      </aside>

      <header className="fixed left-[92px] right-0 top-0 z-20 flex h-[54px] items-center justify-between border-b border-[#e2e5ef] bg-white px-6">
        <div className="flex min-w-0 flex-1 items-center">
          <div className="flex h-8 w-[480px] max-w-full overflow-hidden rounded border border-[#d9deea] bg-white">
            <button className="w-[100px] border-r border-[#d9deea] text-sm text-slate-500" type="button">
              Please se...
            </button>
            <input
              className="min-w-0 flex-1 px-3 text-sm outline-none"
              placeholder="Please enter your search keyword"
              type="search"
            />
            <button className="w-11 text-lg text-slate-500" type="button" aria-label="Search">
              ⌕
            </button>
          </div>
        </div>

        <div className="hidden items-center gap-5 text-sm text-[#202532] xl:flex">
          <span>⊕</span>
          <span>◷ TM</span>
          <span>♧ News</span>
          <span>♫ Customer service</span>
          <span>? Help</span>
          <button className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600" onClick={signOut} type="button">
            Sign out
          </button>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e8eefc] text-xs font-semibold text-[#1769ff]">
            AD
          </span>
        </div>
      </header>

      <main className="min-h-screen pl-[92px] pt-[54px]">{children}</main>
    </div>
  );
}
