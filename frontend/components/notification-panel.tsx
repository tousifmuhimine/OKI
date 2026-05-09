"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bell, CheckCheck, X, AlertTriangle, AlertCircle,
  Info, Trash2, RefreshCw, MessageCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────
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

type NotificationsMeta = {
  total: number;
  unread: number;
  limit: number;
  offset: number;
};

// ─── Helpers ─────────────────────────────────────────────────────
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

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function severityIcon(severity: string) {
  switch (severity) {
    case "critical":
    case "high":
      return { Icon: AlertTriangle, className: "text-rose-500 bg-rose-500/10" };
    case "medium":
      return { Icon: AlertCircle, className: "text-amber-500 bg-amber-500/10" };
    default:
      return { Icon: Info, className: "text-brand-500 bg-brand-500/10" };
  }
}

// ─── Component ───────────────────────────────────────────────────
export function NotificationPanel() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [meta, setMeta] = useState<NotificationsMeta>({
    total: 0, unread: 0, limit: 20, offset: 0,
  });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20", offset: "0" });
      if (unreadOnly) params.set("unread_only", "true");
      const res = await apiRequest<{
        data: NotificationItem[];
        meta: NotificationsMeta;
      }>(`/alerts/notifications?${params.toString()}`);
      setNotifications(res.data);
      setMeta(res.meta);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and polling
  useEffect(() => {
    void fetchNotifications();

    // Poll for new notifications every 30 seconds
    pollingRef.current = setInterval(() => {
      void fetchNotifications(true);
    }, 30000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markAsRead(id: string) {
    try {
      await apiRequest(`/alerts/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      setMeta((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    } catch {
      // silent fail
    }
  }

  async function markAllRead() {
    try {
      await apiRequest("/alerts/notifications/read-all", { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })),
      );
      setMeta((prev) => ({ ...prev, unread: 0 }));
    } catch {
      // silent fail
    }
  }

  async function deleteNotification(id: string) {
    try {
      await apiRequest(`/alerts/notifications/${id}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setMeta((prev) => ({
        ...prev,
        total: prev.total - 1,
        unread: prev.unread - (notifications.find((n) => n.id === id)?.read_at ? 0 : 1),
      }));
    } catch {
      // silent fail
    }
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        id="notification-bell"
        type="button"
        aria-label={`Notifications (${meta.unread} unread)`}
        onClick={() => {
          setOpen(!open);
          if (!open) void fetchNotifications();
        }}
        className="relative flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-brand-50 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-brand-300"
      >
        <Bell size={15} />
        {meta.unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white shadow-[0_0_8px_rgba(99,102,241,0.6)]">
            {meta.unread > 99 ? "99+" : meta.unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-[100] mt-2 w-[380px] max-w-[calc(100vw-16px)] rounded-2xl border border-white/30 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/95 animate-fade-up overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/20 px-4 py-3 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-brand-500" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Alerts
              </span>
              {meta.unread > 0 && (
                <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                  {meta.unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={meta.unread === 0}
                aria-label="Mark all as read"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/40 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200 disabled:opacity-40"
              >
                <CheckCheck size={13} />
              </button>
              <button
                type="button"
                onClick={() => void fetchNotifications()}
                aria-label="Refresh"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/40 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/40 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto">
            {error ? (
              <div className="px-4 py-6 text-center text-xs text-rose-600 dark:text-rose-400">
                {error}
              </div>
            ) : loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
                <RefreshCw className="animate-spin mr-2" size={14} />
                Loading alerts...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                <Bell size={20} className="mx-auto mb-2 opacity-50" />
                No alerts yet
              </div>
            ) : (
              notifications.map((notification) => {
                const { Icon, className: iconClass } = severityIcon(notification.severity);
                const isUnread = !notification.read_at;
                return (
                  <div
                    key={notification.id}
                    className={`group border-b border-white/10 px-4 py-3 transition hover:bg-white/60 dark:hover:bg-white/5 ${
                      isUnread ? "bg-brand-500/5" : "opacity-70"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
                      >
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm ${
                              isUnread
                                ? "font-semibold text-slate-900 dark:text-white"
                                : "font-medium text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {notification.title}
                          </p>
                          <span className="shrink-0 text-[10px] text-slate-500">
                            {formatTime(notification.delivered_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {notification.message}
                        </p>
                        {notification.contact_name && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <MessageCircle size={11} className="text-slate-400" />
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              {notification.contact_name}
                            </span>
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                          {isUnread && (
                            <button
                              type="button"
                              onClick={() => void markAsRead(notification.id)}
                              className="flex items-center gap-1 rounded-lg bg-white/50 px-2 py-1 text-[10px] font-medium text-brand-600 hover:bg-brand-50 dark:bg-white/5 dark:text-brand-400 dark:hover:bg-white/10"
                            >
                              <CheckCheck size={10} /> Mark read
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void deleteNotification(notification.id)}
                            className="flex items-center gap-1 rounded-lg bg-white/50 px-2 py-1 text-[10px] font-medium text-rose-600 hover:bg-rose-50 dark:bg-white/5 dark:text-rose-400 dark:hover:bg-white/10"
                          >
                            <Trash2 size={10} /> Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-white/20 px-4 py-2.5 dark:border-white/10">
              <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                {meta.unread} unread · {meta.total} total
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}