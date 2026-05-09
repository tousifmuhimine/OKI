"use client";

import { useEffect, useState } from "react";
import {
  Activity, BarChart3, MessageCircle, BrainCircuit,
  TrendingUp, Users, HandMetal, ShieldCheck,
  RefreshCw, ChevronDown, Calendar,
  ArrowUpRight, MessageSquare, Bell,
  Zap, Target,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ProtectedPage } from "@/components/protected-page";

// ─── Types ──────────────────────────────────────────────────────
type ChannelStats = {
  channel_type: string;
  active_conversations: number;
  total_conversations: number;
  ai_events: number;
  handovers: number;
  converted_leads: number;
  total_messages: number;
  ai_handover_rate: number;
  conversion_rate: number;
};

type DailyMetric = {
  date: string;
  active_conversations: number;
  new_conversations: number;
  ai_events: number;
  handovers: number;
  converted_leads: number;
};

type AnalyticsResponse = {
  channels: ChannelStats[];
  totals: {
    active_conversations: number;
    ai_events: number;
    handovers: number;
    converted_leads: number;
    total_messages: number;
    unread_notifications: number;
  };
  daily_metrics: DailyMetric[];
  top_converted_sources: { source: string; count: number }[];
  ai_event_types: { type: string; count: number }[];
};

// ─── Helpers ────────────────────────────────────────────────────
function formatSourceLabel(value: string) {
  return value.replace(/_/g, " ");
}

function channelColor(channel: string) {
  const colors: Record<string, string> = {
    facebook: "from-blue-500 to-blue-600",
    instagram: "from-pink-500 to-purple-600",
    whatsapp: "from-emerald-500 to-teal-600",
    email: "from-amber-500 to-orange-600",
    website: "from-cyan-500 to-sky-600",
    api: "from-violet-500 to-indigo-600",
  };
  return colors[channel] || "from-slate-400 to-slate-600";
}

function channelIcon(channel: string) {
  const icons: Record<string, React.ElementType> = {
    facebook: MessageCircle,
    instagram: MessageCircle,
    whatsapp: MessageSquare,
    email: MessageCircle,
    website: BarChart3,
    api: Activity,
  };
  return icons[channel] || Activity;
}

// ─── Bar Chart Component (mini) ─────────────────────────────────
function MiniBar({ data, color = "bg-brand-500" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-12">
      {data.map((val, i) => (
        <div
          key={i}
          className={`w-full rounded-t ${color} transition-all duration-500`}
          style={{ height: `${(val / max) * 100}%`, opacity: 0.3 + (val / max) * 0.7 }}
        />
      ))}
    </div>
  );
}

// ─── Page Component ─────────────────────────────────────────────
export default function PlatformAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const fetchData = async (d: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(d) });
      const res = await apiRequest<AnalyticsResponse>(`/analytics/platform-analytics?${params.toString()}`);
      setData(res);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    void fetchData(days);
  }, []);

  if (loading && !data) {
    return (
      <ProtectedPage>
        <div className="flex min-h-[60vh] items-center justify-center">
          <RefreshCw className="animate-spin text-brand-500" size={24} />
        </div>
      </ProtectedPage>
    );
  }

  if (error && !data) {
    return (
      <ProtectedPage>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        </div>
      </ProtectedPage>
    );
  }

  const periodLabel = days === 1 ? "Today" : days === 7 ? "Last 7 days" : days === 30 ? "Last 30 days" : `Last ${days} days`;

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">
        {/* ── Header ────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">
              <BarChart3 size={20} className="inline mr-2 text-brand-500" />
              Platform Analytics
            </h1>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Channel performance, AI effectiveness, and conversion metrics &middot; {periodLabel}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Time range selector */}
            <div className="relative inline-flex">
              <select
                value={days}
                onChange={(e) => { const v = Number(e.target.value); setDays(v); void fetchData(v); }}
                className="h-9 rounded-xl border border-white/30 bg-white/70 px-3 pr-8 text-xs font-medium text-slate-700 outline-none transition hover:bg-white/90 dark:border-white/10 dark:bg-black/30 dark:text-slate-300 appearance-none cursor-pointer"
              >
                <option value={1}>Today</option>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <ChevronDown size={11} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
            <button
              type="button"
              onClick={() => void fetchData(days)}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-white/30 bg-white/70 px-3 text-xs font-medium text-slate-700 transition hover:bg-white/90 dark:border-white/10 dark:bg-black/30 dark:text-slate-300"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            TOTALS ROW
        ════════════════════════════════════════════════════ */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 animate-fade-up">
          {[
            { label: "Active Conversations", value: data?.totals.active_conversations ?? 0, icon: Activity, color: "text-brand-500 bg-brand-500/10", trend: "+" },
            { label: "AI Events", value: data?.totals.ai_events ?? 0, icon: BrainCircuit, color: "text-cyan-500 bg-cyan-500/10", trend: "+" },
            { label: "Handovers", value: data?.totals.handovers ?? 0, icon: HandMetal, color: "text-amber-500 bg-amber-500/10", trend: "+" },
            { label: "Converted Leads", value: data?.totals.converted_leads ?? 0, icon: Target, color: "text-emerald-500 bg-emerald-500/10", trend: "+" },
            { label: "Total Messages", value: data?.totals.total_messages ?? 0, icon: MessageSquare, color: "text-violet-500 bg-violet-500/10", trend: "+" },
            { label: "Unread Notifications", value: data?.totals.unread_notifications ?? 0, icon: Bell, color: "text-rose-500 bg-rose-500/10", trend: "" },
          ].map((item, i) => (
            <div
              key={item.label}
              className="glass-card flex flex-col gap-2 p-4"
              style={{ animationDelay: `${60 + i * 30}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {item.label}
                </span>
                <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${item.color}`}>
                  <item.icon size={12} />
                </div>
              </div>
              <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {item.value.toLocaleString()}
              </p>
              {item.trend && (
                <div className="flex items-center gap-1">
                  <ArrowUpRight size={11} className="text-emerald-500" />
                  <span className="text-[10px] font-medium text-emerald-500">{item.trend}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            CHANNELS GRID
        ════════════════════════════════════════════════════ */}
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3 animate-fade-up">
          {(data?.channels ?? []).map((channel) => {
            const Icon = channelIcon(channel.channel_type);
            return (
              <div
                key={channel.channel_type}
                className="glass-card overflow-hidden"
                style={{ animationDelay: "100ms" }}
              >
                {/* Channel header */}
                <div className={`bg-gradient-to-r ${channelColor(channel.channel_type)} px-4 py-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className="text-white/90" />
                      <h3 className="text-sm font-bold capitalize text-white">
                        {formatSourceLabel(channel.channel_type)}
                      </h3>
                    </div>
                    <div className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                      {channel.active_conversations} active
                    </div>
                  </div>
                </div>

                {/* Channel stats */}
                <div className="grid grid-cols-2 gap-px bg-white/20 dark:bg-white/5">
                  {[
                    { label: "Conversations", value: channel.total_conversations },
                    { label: "AI Events", value: channel.ai_events, accent: true },
                    { label: "AI Handover Rate", value: `${channel.ai_handover_rate}%`, accent: true },
                    { label: "Conversion Rate", value: `${channel.conversion_rate}%` },
                    { label: "Messages", value: channel.total_messages },
                    { label: "Converted", value: channel.converted_leads, accent: true },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={`px-4 py-3 ${stat.accent ? "bg-white/30 dark:bg-white/5" : "bg-white/20 dark:bg-white/[0.02]"}`}
                    >
                      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {stat.label}
                      </div>
                      <div className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                        {stat.value.toLocaleString?.() ?? stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════════
            BOTTOM ROW
        ════════════════════════════════════════════════════ */}
        <div className="grid gap-6 lg:grid-cols-2 animate-fade-up">

          {/* Daily trend */}
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <TrendingUp size={14} className="text-brand-500" />
                Daily Trend
              </h3>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {data?.daily_metrics.length ?? 0} days
              </span>
            </div>
            <div className="space-y-4">
              {/* AI Events bar chart */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">AI Events</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {data?.daily_metrics.reduce((s, d) => s + d.ai_events, 0) ?? 0}
                  </span>
                </div>
                <MiniBar
                  data={(data?.daily_metrics ?? []).map((d) => d.ai_events)}
                  color="bg-cyan-500"
                />
              </div>

              {/* Handovers bar chart */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Handovers</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {data?.daily_metrics.reduce((s, d) => s + d.handovers, 0) ?? 0}
                  </span>
                </div>
                <MiniBar
                  data={(data?.daily_metrics ?? []).map((d) => d.handovers)}
                  color="bg-amber-500"
                />
              </div>

              {/* Converted leads bar chart */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Converted Leads</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {data?.daily_metrics.reduce((s, d) => s + d.converted_leads, 0) ?? 0}
                  </span>
                </div>
                <MiniBar
                  data={(data?.daily_metrics ?? []).map((d) => d.converted_leads)}
                  color="bg-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Converted sources & AI event types */}
          <div className="space-y-4">
            {/* Top converted sources */}
            <div className="glass-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Target size={14} className="text-emerald-500" />
                  Top Converted Sources
                </h3>
              </div>
              <div className="space-y-2">
                {(data?.top_converted_sources ?? []).length === 0 ? (
                  <p className="py-3 text-xs text-slate-500 dark:text-slate-400">No conversions yet in this period.</p>
                ) : (data?.top_converted_sources ?? []).map((item) => {
                  const total = data?.totals.converted_leads || 1;
                  const width = Math.max(8, (item.count / total) * 100);
                  return (
                    <div key={item.source}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="capitalize text-slate-600 dark:text-slate-300">{formatSourceLabel(item.source)}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{item.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/40 dark:bg-black/20">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI event types breakdown */}
            <div className="glass-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <BrainCircuit size={14} className="text-cyan-500" />
                  AI Events by Type
                </h3>
              </div>
              <div className="space-y-2">
                {(data?.ai_event_types ?? []).length === 0 ? (
                  <p className="py-3 text-xs text-slate-500 dark:text-slate-400">No AI events in this period.</p>
                ) : (data?.ai_event_types ?? []).map((item) => {
                  const total = (data?.ai_event_types ?? []).reduce((s, t) => s + t.count, 0) || 1;
                  const width = Math.max(8, (item.count / total) * 100);
                  return (
                    <div key={item.type}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="capitalize text-slate-600 dark:text-slate-300">{item.type.replace(/_/g, " ")}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{item.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/40 dark:bg-black/20">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </section>
    </ProtectedPage>
  );
}