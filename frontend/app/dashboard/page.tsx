"use client";

import { useEffect, useState } from "react";
import {
  Calendar, Settings, Maximize2, Plus, RefreshCw, X,
  ChevronRight, Target, CheckSquare, MoreHorizontal,
  Clock, TrendingUp, Info, Users, ChevronDown, Zap,
  Activity, ArrowUpRight, Flame, Circle,
} from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { Customer, CustomerListResponse, DashboardSummary } from "@/types/crm";

// ─── Static data ─────────────────────────────────────────────────
const scheduleItems = [
  { color: "bg-brand-500",  title: "Sinai Liberation Day, Egypt",   date: "Apr 25" },
  { color: "bg-indigo-400", title: "Liberation Day, Italy",         date: "Apr 25" },
  { color: "bg-amber-400",  title: "Sales funnel review",           date: "Apr 26" },
  { color: "bg-brand-500",  title: "King Day, Holland",             date: "Apr 27" },
  { color: "bg-cyan-400",   title: "Freedom Day, South Africa",     date: "Apr 27" },
  { color: "bg-rose-400",   title: "Business meetings",             date: "Apr 27" },
  { color: "bg-emerald-400",title: "Customer payment confirmation", date: "Apr 27" },
];

const taskTabs = [
  "All", "Message Replies", "Customer Follow-up",
  "Data Insights", "Approval", "Copy Trading", "Opportunity Follow-up",
];

const goalItems = [
  { key: "leads",         label: "Email marketing contacts", bar: "from-brand-500 to-indigo-400",  icon: Zap },
  { key: "orders",        label: "Closed order amount",      bar: "from-amber-400  to-orange-400",  icon: TrendingUp },
  { key: "opportunities", label: "Opportunities amount",     bar: "from-cyan-400   to-blue-400",    icon: Activity },
  { key: "customers",     label: "New customers",            bar: "from-emerald-400 to-teal-400",   icon: Users },
  { key: "products",      label: "Orders closed",            bar: "from-rose-400   to-pink-400",    icon: Target },
] satisfies Array<{
  key: keyof Pick<DashboardSummary, "customers"|"leads"|"opportunities"|"products"|"orders">;
  label: string; bar: string; icon: React.ElementType;
}>;

function currentTime() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date());
}

// ─── Mini KPI tile ───────────────────────────────────────────────
function KpiTile({
  label, value, trend, trendUp = true, icon: Icon, delay = "0ms",
}: {
  label: string; value: string | number; trend: string;
  trendUp?: boolean; icon: React.ElementType; delay?: string;
}) {
  return (
    <div
      className="glass-card flex flex-col gap-3 p-5 animate-fade-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Icon size={13} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
      <div className="flex items-center gap-1">
        <ArrowUpRight
          size={12}
          className={trendUp ? "text-emerald-500" : "text-rose-400 rotate-90"}
        />
        <span className={`text-xs font-medium ${trendUp ? "text-emerald-500" : "text-rose-400"}`}>
          {trend}
        </span>
      </div>
    </div>
  );
}

// ─── Glass card wrapper ──────────────────────────────────────────
function BCard({
  children, className = "", delay = "0ms",
}: { children: React.ReactNode; className?: string; delay?: string }) {
  return (
    <div
      className={`glass-card animate-fade-up overflow-hidden ${className}`}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

// ─── Card header row ─────────────────────────────────────────────
function CardHead({
  title, sub, actions,
}: { title: React.ReactNode; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between border-b border-white/20 dark:border-white/10 px-5 py-4">
      <div>
        <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
}

function IconBtn({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <button
      type="button" aria-label={label}
      className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/40 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
    >
      <Icon size={13} />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Dashboard
// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const [data, setData]           = useState<DashboardSummary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [clock, setClock]         = useState(currentTime);
  const [activeTab, setActiveTab] = useState(0);
  const [notice, setNotice]       = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiRequest<DashboardSummary>("/dashboard/summary"),
      apiRequest<CustomerListResponse>("/customers?limit=8&offset=0"),
    ]).then(([summary, cust]) => {
      if (!alive) return;
      setData(summary); setCustomers(cust.data); setError(null);
    }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setClock(currentTime()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">

        {/* ── Greeting bar ─────────────────────────────────── */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 animate-fade-up">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">
              Good afternoon, Ji-ho 👋
            </h1>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300 drop-shadow-sm">{today} · Here&apos;s your workspace overview</p>
          </div>
          <div className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
            <Clock size={13} className="text-brand-500 dark:text-brand-400" />
            <span className="text-xs text-slate-600 dark:text-slate-300">Sydney</span>
            <span className="font-mono text-base font-semibold tabular-nums tracking-widest text-slate-800 dark:text-slate-100">
              {clock}
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            GLASS GRID
        ════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

          {/* ── Schedule (tall left card) ─── lg: col 1-7, rows 1-2 */}
          <BCard className="lg:col-span-7 lg:row-span-2" delay="60ms">
            <CardHead
              title={
                <span className="flex items-center gap-2">
                  <Calendar size={14} className="text-brand-500 dark:text-brand-400" />
                  Schedule
                  <ChevronRight size={13} className="text-slate-400" />
                  <span className="inline-flex overflow-hidden rounded-lg border border-white/30 dark:border-white/10 text-[11px] bg-white/20 dark:bg-black/20">
                    {["week", "month", "List"].map((o, i) => (
                      <button
                        key={o} type="button"
                        className={`h-6 px-2.5 transition ${o === "List"
                          ? "bg-brand-500 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                          : "text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/10"
                        } ${i !== 0 ? "border-l border-white/20 dark:border-white/10" : ""}`}
                      >{o}</button>
                    ))}
                  </span>
                </span>
              }
              actions={
                <>
                  <IconBtn icon={Plus}      label="Add" />
                  <IconBtn icon={Settings}  label="Settings" />
                  <IconBtn icon={Maximize2} label="Expand" />
                </>
              }
            />

            {/* Notice banner */}
            {notice && (
              <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-brand-200/50 bg-brand-50/50 px-4 py-2.5 text-xs dark:border-brand-500/20 dark:bg-brand-500/10 backdrop-blur-md">
                <Info size={13} className="shrink-0 text-brand-600 dark:text-brand-400" />
                <span className="flex-1 text-slate-700 dark:text-slate-200">3 new follow-up tasks added</span>
                <button type="button" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
                  Click to refresh
                </button>
                <button type="button" aria-label="Dismiss" onClick={() => setNotice(false)}
                  className="ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
                  <X size={13} />
                </button>
              </div>
            )}

            <div className="px-5 py-3 space-y-0.5">
              {scheduleItems.map((item) => (
                <div
                  key={item.title}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/40 dark:hover:bg-white/5"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${item.color} shadow-[0_0_8px_currentColor]`} />
                  <span className="flex-1 truncate text-sm text-slate-800 dark:text-slate-200">{item.title}</span>
                  <span className="shrink-0 rounded-lg bg-white/50 border border-white/20 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-black/20 dark:border-white/5 dark:text-slate-400">
                    {item.date}
                  </span>
                </div>
              ))}
            </div>
          </BCard>

          {/* ── KPI mini tiles (2×2 grid) ── lg: col 8-12, rows 1-2 */}
          <div className="grid grid-cols-2 gap-4 lg:col-span-5 lg:row-span-2 lg:content-start">
            <KpiTile icon={Target}      label="Goal Completion" value={`${data?.customers ?? 0}%`} trend="+4.2% vs last month" delay="80ms" />
            <KpiTile icon={CheckSquare} label="Tasks Done"      value={data?.orders ?? 0}          trend="+12 this week"       delay="120ms" />
            <KpiTile icon={Flame}       label="Opportunities"   value={data?.opportunities ?? 0}   trend="+3 recycled today"   delay="160ms" />
            <KpiTile icon={Users}       label="Customers"       value={data?.customers ?? 0}        trend="+2 this month"      delay="200ms" />
          </div>

          {/* ── Follow-up tasks ── lg: col 1-7, rows 3-4 */}
          <BCard className="lg:col-span-7 lg:row-span-2" delay="100ms">
            <CardHead
              title="Follow up on tasks"
              sub="AI-recommended tasks based on your pipeline activity"
              actions={
                <button type="button" className="flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/20 dark:border-white/10 dark:bg-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 transition hover:bg-white/40 dark:hover:bg-white/10">
                  <Settings size={11} /> Display settings
                </button>
              }
            />

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 px-5 pt-4 pb-3">
              {taskTabs.map((tab, i) => {
                const count = i === 0 || i === 2 ? customers.length : 0;
                return (
                  <button
                    key={tab} type="button"
                    onClick={() => setActiveTab(i)}
                    className={`h-7 rounded-lg border px-3 text-[11px] font-medium transition ${
                      activeTab === i
                        ? "border-brand-300/50 bg-brand-500/20 text-brand-800 dark:border-brand-400/30 dark:bg-brand-500/20 dark:text-brand-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                        : "border-white/30 bg-white/20 text-slate-600 hover:bg-white/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
                    }`}
                  >
                    {tab} ({count})
                  </button>
                );
              })}
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-white/20 mx-5 mb-5 dark:border-white/10 bg-white/10 dark:bg-black/10">
              <div className="flex items-center justify-between border-b border-white/20 bg-white/20 px-4 py-2.5 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Customers</span>
                  <span className="rounded-md bg-white/40 border border-white/20 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-white/10 dark:border-white/5 dark:text-slate-400">
                    Suspected Failed Mailboxes (99+)
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <button type="button" className="hover:text-slate-800 dark:hover:text-slate-200 transition">Ignore all</button>
                  <button type="button" aria-label="More"><MoreHorizontal size={13} /></button>
                </div>
              </div>

              {error && (
                <p className="px-4 py-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-500/10 backdrop-blur-md">{error}</p>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Nickname</th>
                      <th className="px-4 py-3">Invalid mailboxes</th>
                      <th className="px-4 py-3 text-right">Operation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/20 dark:divide-white/10">
                    {customers.map((row) => (
                      <tr key={row.id} className="group transition hover:bg-white/40 dark:hover:bg-white/10">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{row.company_name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.contact_person ?? "info"}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.country_region ?? "mailbox pending"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2 text-[11px] text-brand-600 dark:text-brand-400 opacity-0 transition group-hover:opacity-100">
                            <button type="button" className="hover:underline drop-shadow-sm">Disable</button>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <button type="button" className="hover:underline drop-shadow-sm">Delete mailbox</button>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <button type="button" className="hover:underline drop-shadow-sm">Ignore</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {customers.length === 0 && (
                      <tr>
                        <td className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={4}>
                          No customer follow-up data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </BCard>

          {/* ── Goal completion ── lg: col 8-12, rows 3-4 */}
          <BCard className="lg:col-span-5" delay="140ms">
            <CardHead
              title={
                <span className="flex items-center gap-2">
                  <Activity size={14} className="text-brand-500 dark:text-brand-400" />
                  Goal Completion
                </span>
              }
              actions={<IconBtn icon={Settings} label="Settings" />}
            />

            <div className="px-5 py-4">
              {/* Toggle */}
              <div className="mb-5 flex overflow-hidden rounded-xl border border-white/30 dark:border-white/10 text-xs bg-white/20 dark:bg-white/5">
                <button type="button" className="flex-1 border-r border-white/30 dark:border-white/10 bg-brand-500 py-2 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                  Outcome Objectives
                </button>
                <button type="button" className="flex-1 py-2 text-slate-600 dark:text-slate-300 transition hover:bg-white/40 dark:hover:bg-white/10">
                  Process objectives
                </button>
              </div>

              <div className="space-y-4">
                {goalItems.map((g) => {
                  const val   = data ? data[g.key] : 0;
                  const width = Math.min(100, val * 10);
                  const Icon  = g.icon;
                  return (
                    <div key={g.key}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <Icon size={11} className="text-slate-500 dark:text-slate-400" />
                          {g.label}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {g.key === "orders" || g.key === "opportunities" ? `¥${val}` : val}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/30 border border-white/20 dark:bg-black/30 dark:border-white/5">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${g.bar} transition-all duration-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        No target set{" "}
                        <button type="button" className="text-brand-600 hover:underline dark:text-brand-400">Set it up now</button>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </BCard>

          {/* ── Task completion ── lg: col 8-12, row 5 */}
          <BCard className="lg:col-span-5" delay="180ms">
            <CardHead
              title={
                <span className="flex items-center gap-2">
                  <CheckSquare size={14} className="text-brand-500 dark:text-brand-400" />
                  Task Completion
                </span>
              }
              actions={
                <>
                  <button type="button" className="flex items-center gap-1 rounded-lg border border-white/30 bg-white/20 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-white/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 transition">
                    Today <ChevronDown size={10} />
                  </button>
                  <span className="flex items-center gap-1 rounded-lg bg-white/40 border border-white/20 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-white/10 dark:border-white/5 dark:text-slate-300">
                    admin <X size={9} className="cursor-pointer" />
                  </span>
                </>
              }
            />

            <div className="px-5 py-5">
              <div className="grid h-[120px] place-items-center">
                <div className="text-center">
                  {/* Mini bar chart placeholder */}
                  <div className="mx-auto mb-3 flex h-10 items-end justify-center gap-1">
                    {[20, 45, 30, 60, 25, 50, 35].map((h, i) => (
                      <div
                        key={i}
                        className="w-4 rounded-t-md bg-gradient-to-t from-brand-500/50 to-brand-500/10 border-t border-x border-white/30 dark:from-brand-500/40 dark:to-brand-500/5 dark:border-white/10"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">No data available</p>
                  <button type="button" className="mt-1.5 flex items-center gap-1.5 text-[11px] text-brand-600 hover:underline mx-auto dark:text-brand-400 drop-shadow-sm">
                    <RefreshCw size={10} /> Refresh data
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                {[
                  { color: "text-emerald-400", label: "Completed in time" },
                  { color: "text-amber-400",   label: "Timeout completion" },
                  { color: "text-slate-400 dark:text-slate-600", label: "Not done" },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <Circle size={7} className={`fill-current ${color}`} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </BCard>

        </div>{/* /glass grid */}
      </section>
    </ProtectedPage>
  );
}
