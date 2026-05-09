"use client";

import { useEffect, useState } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, Bot, BarChart2,
  MessageSquare, TrendingDown, TrendingUp, Users, Zap,
} from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { DashboardSummary, PlatformChannelAnalytics } from "@/types/crm";

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "💬",
  facebook: "📘",
  instagram: "📸",
  email: "📧",
  website: "🌐",
  api: "🔌",
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "text-rose-500",
  medium: "text-amber-500",
  low: "text-emerald-500",
};

function StatCard({
  label, value, icon: Icon, sub, trend, color = "brand",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  trend?: "up" | "down";
  color?: "brand" | "emerald" | "rose" | "amber";
}) {
  const colorMap = {
    brand: "text-brand-500 dark:text-brand-400 bg-brand-500/10",
    emerald: "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10",
    rose: "text-rose-500 dark:text-rose-400 bg-rose-500/10",
    amber: "text-amber-500 dark:text-amber-400 bg-amber-500/10",
  };
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
        <div className={`rounded-xl p-2 ${colorMap[color]}`}>
          <Icon size={16} className={colorMap[color].split(" ")[0]} />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-3xl font-bold text-slate-900 dark:text-white">{value}</span>
        {trend && (
          <span className={trend === "up" ? "text-emerald-500" : "text-rose-500"}>
            {trend === "up" ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

function PlatformRow({ ch }: { ch: PlatformChannelAnalytics }) {
  return (
    <tr className="group transition hover:bg-white/40 dark:hover:bg-white/10">
      <td className="px-5 py-3.5">
        <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
          {CHANNEL_ICONS[ch.channel_type] ?? "📡"}
          {ch.channel_type.charAt(0).toUpperCase() + ch.channel_type.slice(1)}
        </span>
      </td>
      <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{ch.new_conversations}</td>
      <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{ch.active_conversations}</td>
      <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{ch.ai_events_count}</td>
      <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{ch.handover_count}</td>
      <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{ch.converted_leads_count}</td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-white/30 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${Math.min(ch.ai_rate ?? 0, 100)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-brand-600 dark:text-brand-300">{(ch.ai_rate ?? 0).toFixed(1)}%</span>
        </div>
      </td>
    </tr>
  );
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<DashboardSummary>("/dashboard/summary")
      .then((data) => { setSummary(data); setError(null); })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const activePlatforms = summary?.platform_analytics?.filter((p) => p.new_conversations > 0) ?? [];

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">Insights</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white drop-shadow-sm">Platform Analytics</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            AI performance, platform efficiency, and conversion intelligence.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid min-h-[60vh] place-items-center text-sm text-slate-500 dark:text-slate-400">
            Loading analytics...
          </div>
        ) : summary ? (
          <>
            {/* AI Monitoring Cards */}
            <div className="mb-8">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Bot size={14} /> AI Performance
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total Conversations"
                  value={summary.total_conversations}
                  icon={MessageSquare}
                  color="brand"
                />
                <StatCard
                  label="AI Responses"
                  value={summary.ai_response_count}
                  icon={Bot}
                  sub="Automated replies generated"
                  color="brand"
                />
                <StatCard
                  label="Human Takeovers"
                  value={summary.human_takeover_count}
                  icon={Users}
                  sub="Agent-assisted sessions"
                  color="amber"
                />
                <StatCard
                  label="Failed Conversations"
                  value={summary.failed_conversations}
                  icon={AlertTriangle}
                  sub="Resolved without conversion"
                  color="rose"
                />
              </div>
            </div>

            {/* Conversion & Drop-off */}
            <div className="mb-8">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <BarChart2 size={14} /> Conversion Intelligence
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                  label="Conversion Rate"
                  value={`${summary.conversion_rate}%`}
                  icon={ArrowUpRight}
                  sub="Leads converted to customers"
                  trend="up"
                  color="emerald"
                />
                <StatCard
                  label="Drop-off Rate"
                  value={`${summary.drop_off_rate}%`}
                  icon={TrendingDown}
                  sub="Leads marked as lost"
                  trend="down"
                  color="rose"
                />
                <StatCard
                  label="Unread Alerts"
                  value={summary.unread_notifications}
                  icon={Zap}
                  sub="Pending AI escalation alerts"
                  color={summary.unread_notifications > 0 ? "amber" : "emerald"}
                />
              </div>
            </div>

            {/* Per-Platform Table */}
            <div className="mb-8">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Activity size={14} /> Platform Breakdown
              </h2>
              <div className="glass-card animate-fade-up overflow-hidden rounded-2xl">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-white/20 bg-white/20 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                      <th className="px-5 py-3.5">Platform</th>
                      <th className="px-5 py-3.5">Total</th>
                      <th className="px-5 py-3.5">Active</th>
                      <th className="px-5 py-3.5">AI Events</th>
                      <th className="px-5 py-3.5">Handovers</th>
                      <th className="px-5 py-3.5">Converted</th>
                      <th className="px-5 py-3.5">AI Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/20 dark:divide-white/10">
                    {summary.platform_analytics.map((ch) => (
                      <PlatformRow key={ch.channel_type} ch={ch} />
                    ))}
                    {summary.platform_analytics.length === 0 && (
                      <tr>
                        <td className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={7}>
                          No platform data yet. Start receiving messages.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Platforms summary */}
            {activePlatforms.length > 0 && (
              <div>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Zap size={14} /> Most Active Channels
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activePlatforms
                    .sort((a, b) => b.new_conversations - a.new_conversations)
                    .slice(0, 3)
                    .map((ch) => (
                      <div key={ch.channel_type} className="glass-card rounded-2xl p-4 flex items-center gap-4">
                        <span className="text-3xl">{CHANNEL_ICONS[ch.channel_type] ?? "📡"}</span>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white capitalize">{ch.channel_type}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{ch.new_conversations} total · {ch.converted_leads_count} converted</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>
    </ProtectedPage>
  );
}
