"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCheck, Clock3, RefreshCw, ShieldAlert, Users, MessageSquare, ExternalLink } from "lucide-react";
import Link from "next/link";
import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";

type NotificationItem = {
  id: string;
  alert_rule_id: string | null;
  conversation_id: string | null;
  lead_id: string | null;
  title: string;
  message: string;
  severity: string;
  payload: Record<string, unknown>;
  contact_name: string | null;
  delivered_at: string | null;
  read_at: string | null;
};

type NotificationsResponse = {
  data: NotificationItem[];
  meta: { total: number; unread: number; limit: number; offset: number };
};

function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function isSeriousNotification(item: NotificationItem) {
  const title = item.title.toLowerCase();
  const message = item.message.toLowerCase();
  const payload = JSON.stringify(item.payload || {}).toLowerCase();
  return (
    item.severity === "high" ||
    item.severity === "critical" ||
    title.includes("serious") ||
    title.includes("needs attention") ||
    message.includes("reviewed") ||
    payload.includes("serious")
  );
}

export default function AINotificationPage() {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<NotificationsResponse>("/alerts/notifications?limit=100&offset=0");
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

  const seriousNotifications = useMemo(
    () => (data?.data ?? []).filter(isSeriousNotification),
    [data],
  );

  const unreadSerious = seriousNotifications.filter((item) => !item.read_at).length;

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">
              <AlertTriangle size={20} className="inline mr-2 text-amber-500" /> AI Notification
            </h1>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Serious customer alerts that should be managed manually by the team
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchData()}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-white/30 bg-white/70 px-3 text-xs font-medium text-slate-700 transition hover:bg-white/90 dark:border-white/10 dark:bg-black/30 dark:text-slate-300"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <Link
              href="/dashboard/ai-monitor"
              className="flex h-9 items-center gap-1.5 rounded-xl border border-white/30 bg-white/70 px-3 text-xs font-medium text-slate-700 transition hover:bg-white/90 dark:border-white/10 dark:bg-black/30 dark:text-slate-300"
            >
              <ExternalLink size={12} />
              AI Intelligence
            </Link>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3 animate-fade-up">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Serious Alerts</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500"><AlertTriangle size={13} /></div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{seriousNotifications.length}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Unread</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"><Clock3 size={13} /></div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{unreadSerious}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Manual Review</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><ShieldAlert size={13} /></div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Required</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="glass-card overflow-hidden animate-fade-up">
          <div className="flex items-center justify-between border-b border-white/20 px-5 py-4 dark:border-white/10">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Users size={14} className="text-brand-500" />
              Serious customer queue
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Only alerts requiring manual handling</span>
          </div>

          <div className="divide-y divide-white/10 dark:divide-white/5">
            {loading ? (
              <div className="flex items-center justify-center px-5 py-10 text-sm text-slate-500 dark:text-slate-400">
                <RefreshCw className="mr-2 animate-spin" size={14} /> Loading serious alerts...
              </div>
            ) : seriousNotifications.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No serious customer alerts yet.
              </div>
            ) : (
              seriousNotifications.map((item) => (
                <div key={item.id} className="px-5 py-4 transition hover:bg-white/30 dark:hover:bg-white/5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${item.severity === "critical" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>
                          {item.severity}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{formatTime(item.delivered_at)}</span>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        {item.contact_name && <span>{item.contact_name}</span>}
                        {item.lead_id && <span>Lead: {item.lead_id.slice(0, 8)}</span>}
                        {item.conversation_id && <span>Conversation: {item.conversation_id.slice(0, 8)}</span>}
                      </div>
                    </div>
                    {!item.read_at && (
                      <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        Manual review pending
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </ProtectedPage>
  );
}