"use client";

import { useEffect, useState } from "react";
import {
  BrainCircuit, Bot, Activity, AlertTriangle,
  AlertCircle, CheckCircle, RefreshCw, ChevronDown,
  ArrowUpRight, MessageSquare, HandMetal, Zap,
  ShieldCheck, Settings, BarChart3,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ProtectedPage } from "@/components/protected-page";

// ─── Types ──────────────────────────────────────────────────────
type LLMConfig = {
  id: string;
  provider: string;
  default_model: string | null;
  automation_modes: Record<string, string>;
  created_at: string;
};

type AIEvent = {
  id: string;
  conversation_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type AIStatus = {
  configured: boolean;
  error: string | null;
  configs: LLMConfig[];
  recent_events: AIEvent[];
  intent_breakdown: Record<string, number>;
  engagement_breakdown: Record<string, number>;
  trust_level_breakdown: Record<string, number>;
  lead_status_breakdown: Record<string, number>;
  leads_with_budget: number;
  active_leads_count: number;
  closed_leads_count: number;
  events_today: number;
  events_this_week: number;
  handovers_today: number;
  handovers_this_week: number;
  automation_summary: Record<string, string>;
};

// ─── Helpers ────────────────────────────────────────────────────
function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function eventTypeIcon(type: string) {
  switch (type) {
    case "handover_trigger":
      return { Icon: HandMetal, className: "text-amber-500 bg-amber-500/10" };
    case "intent_detected":
      return { Icon: BrainCircuit, className: "text-cyan-500 bg-cyan-500/10" };
    case "auto_reply":
      return { Icon: Bot, className: "text-brand-500 bg-brand-500/10" };
    case "lead_captured":
      return { Icon: Zap, className: "text-emerald-500 bg-emerald-500/10" };
    default:
      return { Icon: Activity, className: "text-slate-500 bg-slate-500/10" };
  }
}

function topItem(breakdown: Record<string, number>) {
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0];
}

// ─── Component ──────────────────────────────────────────────────
export default function AIMonitorPage() {
  const [data, setData] = useState<AIStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<AIStatus>("/ai/monitor/status");
      setData(res);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const filteredEvents = data?.recent_events?.filter((e) => {
    if (filterType === "all") return true;
    return e.event_type === filterType;
  }) ?? [];

  // Event type summary counts
  const eventTypeCounts = (data?.recent_events ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">
        {/* ── Header ────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">
              <BrainCircuit size={20} className="inline mr-2 text-brand-500" />
              AI Monitoring
            </h1>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Real-time AI automation status, event stream, and configuration overview
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchData()}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/30 bg-white/70 px-3 text-xs font-medium text-slate-700 transition hover:bg-white/90 dark:border-white/10 dark:bg-black/30 dark:text-slate-300"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════
            STATUS CARDS
        ════════════════════════════════════════════════════ */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 animate-fade-up">
          <div className="glass-card flex flex-col gap-2 p-4" style={{ animationDelay: "60ms" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</span>
              {data?.configured === false ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500"><AlertTriangle size={12} /></div>
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><CheckCircle size={12} /></div>
              )}
            </div>
            <p className={`text-base font-bold tracking-tight ${data?.configured ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {data?.configured ? "Active" : "Not Configured"}
            </p>
            {data?.error && <p className="text-[10px] text-rose-500 dark:text-rose-400">{data.error}</p>}
          </div>

          <div className="glass-card flex flex-col gap-2 p-4" style={{ animationDelay: "90ms" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Today</span>
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500"><Activity size={12} /></div>
            </div>
            <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white">{data?.events_today ?? 0}</p>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-amber-500">{data?.handovers_today ?? 0} handovers</span>
            </div>
          </div>

          <div className="glass-card flex flex-col gap-2 p-4" style={{ animationDelay: "120ms" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">This Week</span>
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"><BarChart3 size={12} /></div>
            </div>
            <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white">{data?.events_this_week ?? 0}</p>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-amber-500">{data?.handovers_this_week ?? 0} handovers</span>
            </div>
          </div>

          <div className="glass-card flex flex-col gap-2 p-4" style={{ animationDelay: "150ms" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Models</span>
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500"><Bot size={12} /></div>
            </div>
            <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white">{data?.configs?.length ?? 0}</p>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-500">active providers</span>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3 animate-fade-up">
          {[
            { title: "Intent", icon: BrainCircuit, accent: "text-cyan-500", breakdown: data?.intent_breakdown ?? {}, empty: "No intent signals yet" },
            { title: "Engagement", icon: HandMetal, accent: "text-amber-500", breakdown: data?.engagement_breakdown ?? {}, empty: "No engagement signals yet" },
            { title: "Trust Level", icon: ShieldCheck, accent: "text-emerald-500", breakdown: data?.trust_level_breakdown ?? {}, empty: "No trust signals yet" },
          ].map(({ title, icon: Icon, accent, breakdown, empty }, index) => {
            const top = topItem(breakdown);
            const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
            return (
              <div key={title} className="glass-card flex flex-col gap-3 p-4" style={{ animationDelay: `${60 + index * 40}ms` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <Icon size={14} className={accent} />
                    {title}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Hidden lead signal</span>
                </div>
                {top ? (
                  <>
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Top signal</div>
                        <div className="text-base font-bold capitalize text-slate-900 dark:text-white">{top[0].replace(/_/g, " ")}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Count</div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">{top[1]}</div>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/40 dark:bg-black/20">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${
                          title === "Intent"
                            ? "from-cyan-400 to-blue-500"
                            : title === "Engagement"
                              ? "from-amber-400 to-orange-400"
                              : "from-emerald-400 to-green-500"
                        }`}
                        style={{ width: `${Math.max(10, (top[1] / Math.max(total || 1, top[1])) * 100)}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 py-2">{empty}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr] animate-fade-up">
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Activity size={14} className="text-brand-500" /> Lead Management
              </h3>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Connected to hidden signals</span>
            </div>
            <div className="space-y-2">
              {Object.keys(data?.lead_status_breakdown ?? {}).length === 0 ? (
                <p className="py-3 text-xs text-slate-500 dark:text-slate-400">No lead status data yet.</p>
              ) : Object.entries(data?.lead_status_breakdown ?? {}).map(([status, count]) => {
                const total = (data?.active_leads_count ?? 0) + (data?.closed_leads_count ?? 0) || 1;
                const width = Math.max(8, (count / total) * 100);
                return (
                  <div key={status}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="capitalize text-slate-600 dark:text-slate-300">{status.replace(/_/g, " ")}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/40 dark:bg-black/20">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-indigo-500" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <ShieldCheck size={14} className="text-emerald-500" /> Lead Snapshot
              </h3>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Pipeline totals</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/35 p-3 dark:bg-white/5">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Active Leads</div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{data?.active_leads_count ?? 0}</div>
              </div>
              <div className="rounded-xl bg-white/35 p-3 dark:bg-white/5">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Closed Leads</div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{data?.closed_leads_count ?? 0}</div>
              </div>
              <div className="rounded-xl bg-white/35 p-3 dark:bg-white/5">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Budget Leads</div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{data?.leads_with_budget ?? 0}</div>
              </div>
              <div className="rounded-xl bg-white/35 p-3 dark:bg-white/5">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Hidden Signals</div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{Object.values(data?.intent_breakdown ?? {}).reduce((sum, value) => sum + value, 0) + Object.values(data?.engagement_breakdown ?? {}).reduce((sum, value) => sum + value, 0) + Object.values(data?.trust_level_breakdown ?? {}).reduce((sum, value) => sum + value, 0)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ══════════════════════════════════════════════════════
              LEFT: CONFIGURATION
          ════════════════════════════════════════════════════ */}
          <div className="space-y-4 lg:col-span-1">
            {/* LLM Configs */}
            <div className="glass-card animate-fade-up" style={{ animationDelay: "180ms" }}>
              <div className="flex items-center justify-between border-b border-white/20 px-5 py-4 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Settings size={14} className="text-brand-500" />
                  LLM Configs
                </div>
                <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                  {data?.configs?.length ?? 0}
                </span>
              </div>
              <div className="px-5 py-3">
                {!data?.configs?.length ? (
                  <div className="flex flex-col items-center py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    <Bot size={20} className="mb-2 opacity-40" />
                    No LLM providers configured.
                    <a href="/dashboard/settings/channels" className="mt-2 text-brand-600 hover:underline">Configure AI</a>
                  </div>
                ) : data.configs.map((cfg) => (
                  <div key={cfg.id} className="mb-3 rounded-xl border border-white/30 bg-white/30 p-3 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold capitalize text-slate-800 dark:text-slate-100">{cfg.provider}</span>
                      <span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:text-brand-300">
                        {cfg.default_model || "default"}
                      </span>
                    </div>
                    {Object.keys(cfg.automation_modes ?? {}).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(cfg.automation_modes).map(([channel, mode]) => (
                          <span
                            key={channel}
                            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                              mode === "chatbot"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : "bg-slate-500/15 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            <Zap size={9} />
                            {channel}: {mode}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Automation Summary */}
            <div className="glass-card animate-fade-up" style={{ animationDelay: "200ms" }}>
              <div className="flex items-center justify-between border-b border-white/20 px-5 py-4 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Bot size={14} className="text-emerald-500" />
                  Automation Modes
                </div>
              </div>
              <div className="px-5 py-3">
                {!data?.automation_summary || Object.keys(data.automation_summary).length === 0 ? (
                  <p className="py-3 text-center text-xs text-slate-500">No channels configured with automation.</p>
                ) : Object.entries(data.automation_summary).map(([channel, mode]) => (
                  <div key={channel} className="mb-2 flex items-center justify-between rounded-xl bg-white/30 px-3 py-2 dark:bg-white/5">
                    <span className="text-xs capitalize text-slate-600 dark:text-slate-300">{channel.replace(/_/g, " ")}</span>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                      mode === "chatbot"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-500/15 text-slate-600 dark:text-slate-400"
                    }`}>
                      {mode}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              RIGHT: EVENT STREAM
          ════════════════════════════════════════════════════ */}
          <div className="lg:col-span-2">
            <div className="glass-card animate-fade-up" style={{ animationDelay: "220ms" }}>
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between border-b border-white/20 px-5 py-4 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Activity size={14} className="text-brand-500" />
                  Recent AI Events
                  <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                    {data?.recent_events?.length ?? 0}
                  </span>
                </div>

                {/* Filter */}
                <div className="relative inline-flex">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="h-8 rounded-xl border border-white/30 bg-white/60 pl-2.5 pr-7 text-[11px] font-medium text-slate-700 outline-none transition hover:bg-white/90 dark:border-white/10 dark:bg-black/20 dark:text-slate-300 appearance-none cursor-pointer"
                  >
                    <option value="all">All Events</option>
                    {Object.entries(eventTypeCounts).map(([type, count]) => (
                      <option key={type} value={type}>{type.replace(/_/g, " ")} ({count})</option>
                    ))}
                  </select>
                  <ChevronDown size={10} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              {/* Event list */}
              <div className="max-h-[540px] overflow-y-auto">
                {filteredEvents.length === 0 ? (
                  <div className="flex flex-col items-center px-5 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                    <Activity size={24} className="mb-2 opacity-30" />
                    No AI events yet in this category.
                  </div>
                ) : filteredEvents.map((event) => {
                  const { Icon, className } = eventTypeIcon(event.event_type);
                  const payloadStr = event.payload
                    ? Object.entries(event.payload)
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${typeof v === "string" ? v.substring(0, 60) : JSON.stringify(v)}`)
                        .join(" | ")
                    : "";
                  return (
                    <div
                      key={event.id}
                      className="group border-b border-white/10 px-5 py-3 transition hover:bg-white/40 dark:hover:bg-white/5"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${className}`}>
                          <Icon size={12} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 capitalize">
                              {event.event_type.replace(/_/g, " ")}
                            </p>
                            <span className="shrink-0 text-[10px] text-slate-500">
                              {formatTime(event.created_at)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                            Conv: {event.conversation_id?.substring(0, 8) ?? "N/A"}
                          </p>
                          {payloadStr && (
                            <p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">
                              {payloadStr}
                            </p>
                          )}
                        </div>
                        <ArrowUpRight size={11} className="shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100" />
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