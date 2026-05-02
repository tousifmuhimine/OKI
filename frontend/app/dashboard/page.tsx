"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Calendar, Settings, Maximize2, Plus, RefreshCw, X,
  ChevronRight, Target, CheckSquare, MoreHorizontal,
  Clock, TrendingUp, Info, Users, ChevronDown, Zap,
  Activity, ArrowUpRight, Flame, Circle, ChevronLeft,
  CalendarDays, AlignLeft,
} from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";
import { Customer, CustomerListResponse, DashboardSummary } from "@/types/crm";

// ─── Types ───────────────────────────────────────────────────────
type TaskEvent = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  priority: string;
};

type TaskListResponse = {
  data: TaskEvent[];
  meta: { total: number; limit: number; offset: number };
};

// ─── Static data ─────────────────────────────────────────────────
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

const ALL_TIMEZONES = [
  { label: "Dhaka", tz: "Asia/Dhaka" },
  { label: "Sydney", tz: "Australia/Sydney" },
  { label: "Beijing", tz: "Asia/Shanghai" },
  { label: "Toronto", tz: "America/Toronto" },
  { label: "New York", tz: "America/New_York" },
  { label: "London", tz: "Europe/London" },
  { label: "Dubai", tz: "Asia/Dubai" },
  { label: "Tokyo", tz: "Asia/Tokyo" },
  { label: "Singapore", tz: "Asia/Singapore" },
  { label: "Berlin", tz: "Europe/Berlin" },
  { label: "Los Angeles", tz: "America/Los_Angeles" },
];

// ─── Utilities ───────────────────────────────────────────────────
function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone
  }).format(date);
}

function getDaysInMonth(year: number, month: number) {
  const date = new Date(year, month, 1);
  const days = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

// ─── Components ──────────────────────────────────────────────────
function KpiTile({ label, value, trend, trendUp = true, icon: Icon, delay = "0ms" }: any) {
  return (
    <div className="glass-card flex flex-col gap-3 p-5 animate-fade-up" style={{ animationDelay: delay }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Icon size={13} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
      <div className="flex items-center gap-1">
        <ArrowUpRight size={12} className={trendUp ? "text-emerald-500" : "text-rose-400 rotate-90"} />
        <span className={`text-xs font-medium ${trendUp ? "text-emerald-500" : "text-rose-400"}`}>{trend}</span>
      </div>
    </div>
  );
}

function BCard({ children, className = "", delay = "0ms" }: any) {
  return (
    <div className={`glass-card animate-fade-up overflow-hidden ${className}`} style={{ animationDelay: delay }}>
      {children}
    </div>
  );
}

function CardHead({ title, sub, actions }: any) {
  return (
    <div className="flex items-start justify-between border-b border-white/20 dark:border-white/10 px-5 py-4">
      <div>
        <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">{title}</div>
        {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
}

function IconBtn({ icon: Icon, label, onClick }: any) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/40 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200">
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
  const [activeTab, setActiveTab] = useState(0);
  const [notice, setNotice]       = useState(true);
  const [userName, setUserName]   = useState("Ji-ho");

  // Single custom timezone clock
  const [now, setNow] = useState(new Date());
  const [activeTimezone, setActiveTimezone] = useState({ label: "Dhaka", tz: "Asia/Dhaka" });
  const [clockDropdownOpen, setClockDropdownOpen] = useState(false);

  // Calendar State
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [calendarView, setCalendarView] = useState<"List" | "Week" | "Month">("List");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", due_date: "", priority: "medium" });
  const [loadingEvents, setLoadingEvents] = useState(false);

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
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    getSupabaseClient().auth.getUser().then(({ data }) => {
      if (data.user) {
        const name = data.user.user_metadata?.name || data.user.email?.split('@')[0] || "Ji-ho";
        setUserName(name);
      }
    });
  }, []);

  // Fetch events for the current month
  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const year = currentDate.getFullYear();
      const monthStr = String(currentDate.getMonth() + 1).padStart(2, "0");
      const res = await apiRequest<TaskListResponse>(`/tasks?entity_type=event&month=${year}-${monthStr}`);
      setEvents(res.data);
    } catch (e) {
      console.error("Failed to load events:", e);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [currentDate.getMonth(), currentDate.getFullYear()]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.due_date) return;
    try {
      const due = new Date(newEvent.due_date).toISOString();
      await apiRequest("/tasks", {
        method: "POST",
        body: JSON.stringify({
          entity_type: "event",
          title: newEvent.title,
          due_date: due,
          priority: newEvent.priority,
        }),
      });
      setShowAddEvent(false);
      setNewEvent({ title: "", due_date: "", priority: "medium" });
      loadEvents();
    } catch (err) {
      alert("Failed to add event: " + (err as Error).message);
    }
  };

  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const getPriorityColor = (prio: string) => {
    if (prio === "high") return "bg-rose-500";
    if (prio === "medium") return "bg-amber-500";
    return "bg-brand-500";
  };

  const renderCalendar = () => {
    if (calendarView === "List") {
      const upcoming = events.filter(e => e.due_date && new Date(e.due_date).getTime() >= new Date().setHours(0,0,0,0)).sort((a,b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
      return (
        <div className="px-5 py-3 space-y-1 max-h-[300px] overflow-y-auto hide-scrollbar">
          {upcoming.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No upcoming events.</p>}
          {upcoming.map(item => (
            <div key={item.id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/40 dark:hover:bg-white/5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${getPriorityColor(item.priority)} shadow-[0_0_8px_currentColor]`} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{item.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.description || "Event"}</p>
              </div>
              <span className="shrink-0 rounded-lg bg-white/50 border border-white/20 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-black/20 dark:border-white/5 dark:text-slate-400">
                {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(item.due_date!))}
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (calendarView === "Month") {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const days = getDaysInMonth(year, month);
      const firstDayOfWeek = days[0].getDay();
      
      const padding = Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`pad-${i}`} className="p-2 border border-white/5 bg-black/5 dark:bg-white/5 opacity-50" />);
      
      return (
        <div className="px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
            <div className="flex gap-1">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-white/20 rounded"><ChevronLeft size={14}/></button>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-white/20 rounded"><ChevronRight size={14}/></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500 mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 text-sm">
            {padding}
            {days.map(date => {
              const localYear = date.getFullYear();
              const localMonth = String(date.getMonth() + 1).padStart(2, '0');
              const localDate = String(date.getDate()).padStart(2, '0');
              const dateStr = `${localYear}-${localMonth}-${localDate}`;
              
              const dayEvents = events.filter(e => {
                if (!e.due_date) return false;
                const eDate = new Date(e.due_date);
                return eDate.getFullYear() === date.getFullYear() && eDate.getMonth() === date.getMonth() && eDate.getDate() === date.getDate();
              });
              
              const today = new Date();
              const isToday = today.getFullYear() === date.getFullYear() && today.getMonth() === date.getMonth() && today.getDate() === date.getDate();
              
              return (
                <div key={date.toISOString()} className={`min-h-[60px] p-1 border rounded-lg ${isToday ? 'border-brand-500 bg-brand-500/10' : 'border-white/20 dark:border-white/10 bg-white/20 dark:bg-white/5'} flex flex-col`}>
                  <div className={`text-right text-xs ${isToday ? 'font-bold text-brand-600 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400'}`}>
                    {date.getDate()}
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5 mt-1 overflow-y-auto hide-scrollbar">
                    {dayEvents.map(ev => (
                      <div key={ev.id} className={`text-[9px] px-1 rounded truncate text-white ${getPriorityColor(ev.priority)}`} title={ev.title}>
                        {ev.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    
    // Week View placeholder for simplicity
    return (
      <div className="px-5 py-8 text-center text-sm text-slate-500">
        Week view coming soon. Select Month or List view.
      </div>
    );
  };

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">

        {/* ── Greeting & Multi-TZ Clocks ──────────────────────── */}
        <div className="relative z-50 mb-5 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">
              Good afternoon, {userName} 👋
            </h1>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300 drop-shadow-sm">{todayStr} · Here&apos;s your workspace overview</p>
          </div>
          
          <div className="relative">
            <button
              onClick={() => setClockDropdownOpen(!clockDropdownOpen)}
              className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.1)] hover:bg-white/40 dark:hover:bg-white/10 transition"
            >
              <Clock size={13} className="text-brand-500 dark:text-brand-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
                {activeTimezone.label} <ChevronDown size={11} className={`transition-transform ${clockDropdownOpen ? 'rotate-180' : ''}`} />
              </span>
              <span className="font-mono text-base font-semibold tabular-nums tracking-widest text-slate-800 dark:text-slate-100">
                {formatTime(now, activeTimezone.tz)}
              </span>
            </button>

            {clockDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setClockDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-44 rounded-xl border border-white/20 bg-white/95 dark:border-white/10 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl animate-fade-up overflow-hidden">
                  <div className="max-h-60 overflow-y-auto py-1 hide-scrollbar">
                    {ALL_TIMEZONES.map(t => (
                      <button
                        key={t.tz}
                        onClick={() => { setActiveTimezone(t); setClockDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition flex items-center justify-between ${t.tz === activeTimezone.tz ? 'bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                      >
                        {t.label}
                        {t.tz === activeTimezone.tz && <div className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
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
                <>
                  <Calendar size={14} className="text-brand-500 dark:text-brand-400" />
                  Schedule
                  <ChevronRight size={13} className="text-slate-400 mx-1" />
                  <div className="inline-flex overflow-hidden rounded-lg border border-white/30 dark:border-white/10 text-[11px] bg-white/20 dark:bg-black/20">
                    {(["List", "Week", "Month"] as const).map((view, i) => (
                      <button
                        key={view} onClick={() => setCalendarView(view)}
                        className={`h-6 px-3 flex items-center gap-1 transition ${calendarView === view
                          ? "bg-brand-500 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                          : "text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/10"
                        } ${i !== 0 ? "border-l border-white/20 dark:border-white/10" : ""}`}
                      >
                        {view === "List" && <AlignLeft size={10} />}
                        {view === "Week" && <CalendarDays size={10} />}
                        {view === "Month" && <Calendar size={10} />}
                        {view}
                      </button>
                    ))}
                  </div>
                </>
              }
              actions={
                <>
                  <IconBtn icon={Plus} label="Add Event" onClick={() => setShowAddEvent(true)} />
                  <IconBtn icon={RefreshCw} label="Refresh" onClick={loadEvents} />
                  <IconBtn icon={Maximize2} label="Expand" />
                </>
              }
            />

            {/* Notice banner */}
            {notice && (
              <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-brand-200/50 bg-brand-50/50 px-4 py-2.5 text-xs dark:border-brand-500/20 dark:bg-brand-500/10 backdrop-blur-md">
                <Info size={13} className="shrink-0 text-brand-600 dark:text-brand-400" />
                <span className="flex-1 text-slate-700 dark:text-slate-200">{events.length} schedule events this month</span>
                <button type="button" onClick={() => setNotice(false)} className="ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
                  <X size={13} />
                </button>
              </div>
            )}

            <div className="relative min-h-[250px]">
              {loadingEvents && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/20 dark:bg-black/20 backdrop-blur-[2px] z-10">
                  <RefreshCw className="animate-spin text-brand-500" />
                </div>
              )}
              {renderCalendar()}
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
              title={<><CheckSquare size={14} className="text-brand-500" /> Follow up on tasks</>}
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
                    key={tab} type="button" onClick={() => setActiveTab(i)}
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
                            <button type="button" className="hover:underline">Disable</button><span className="text-slate-300 dark:text-slate-600">|</span>
                            <button type="button" className="hover:underline">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {customers.length === 0 && (
                      <tr><td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={4}>No follow-up data available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </BCard>

          {/* ── Goal completion ── lg: col 8-12, rows 3-4 */}
          <BCard className="lg:col-span-5" delay="140ms">
            <CardHead title={<><Activity size={14} className="text-brand-500" /> Goal Completion</>} actions={<IconBtn icon={Settings} label="Settings" />} />
            <div className="px-5 py-4">
              <div className="mb-5 flex overflow-hidden rounded-xl border border-white/30 dark:border-white/10 text-xs bg-white/20 dark:bg-white/5">
                <button type="button" className="flex-1 border-r border-white/30 dark:border-white/10 bg-brand-500 py-2 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">Outcome Objectives</button>
                <button type="button" className="flex-1 py-2 text-slate-600 dark:text-slate-300 transition hover:bg-white/40 dark:hover:bg-white/10">Process objectives</button>
              </div>
              <div className="space-y-4">
                {goalItems.map((g) => {
                  const val = data ? data[g.key] : 0;
                  const width = Math.min(100, val * 10);
                  const Icon = g.icon;
                  return (
                    <div key={g.key}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"><Icon size={11} className="text-slate-500" />{g.label}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{g.key === "orders" || g.key === "opportunities" ? `¥${val}` : val}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/30 border border-white/20 dark:bg-black/30 dark:border-white/5">
                        <div className={`h-full rounded-full bg-gradient-to-r ${g.bar} transition-all duration-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </BCard>

          {/* ── Task completion ── lg: col 8-12, row 5 */}
          <BCard className="lg:col-span-5" delay="180ms">
            <CardHead title={<><CheckSquare size={14} className="text-brand-500" /> Task Completion</>} />
            <div className="px-5 py-5 text-center">
               <div className="mx-auto mb-3 flex h-10 items-end justify-center gap-1">
                 {[20, 45, 30, 60, 25, 50, 35].map((h, i) => (
                   <div key={i} className="w-4 rounded-t-md bg-gradient-to-t from-brand-500/50 to-brand-500/10 border-t border-x border-white/30 dark:from-brand-500/40 dark:to-brand-500/5 dark:border-white/10" style={{ height: `${h}%` }} />
                 ))}
               </div>
               <p className="text-xs text-slate-500">No data available</p>
            </div>
          </BCard>

        </div>{/* /glass grid */}

      </section>

      {/* ─── Add Event Modal ────────────────────────────────────── */}
      {showAddEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-fade-up">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar size={18} className="text-brand-500" /> Add Event
              </h2>
              <button onClick={() => setShowAddEvent(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Event Title *</label>
                <input required value={newEvent.title} onChange={e => setNewEvent(prev => ({...prev, title: e.target.value}))} placeholder="e.g. Sales review" autoFocus
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Date & Time *</label>
                <input type="datetime-local" required value={newEvent.due_date} onChange={e => setNewEvent(prev => ({...prev, due_date: e.target.value}))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Priority</label>
                <select value={newEvent.priority} onChange={e => setNewEvent(prev => ({...prev, priority: e.target.value}))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white">
                  <option value="low">Low (Blue)</option>
                  <option value="medium">Medium (Amber)</option>
                  <option value="high">High (Red)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddEvent(false)} className="flex-1 h-11 rounded-xl border border-slate-200 bg-white/60 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">Cancel</button>
                <button type="submit" className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-sm font-semibold text-white shadow-glow-sm hover:from-brand-400 active:scale-95">
                  <Plus size={16} /> Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedPage>
  );
}
