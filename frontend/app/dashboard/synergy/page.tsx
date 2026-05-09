"use client";

import { useEffect, useState } from "react";
import {
  Infinity, BarChart3, Activity, RefreshCw, Users,
  CheckCircle, AlertTriangle,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ProtectedPage } from "@/components/protected-page";

type TasksSummaryItem = {
  assigned_user_id: string;
  count: number;
  pending: number;
  done: number;
};

type TeamUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  permissions: string[];
  task_count: number;
};

type TeamListResponse = {
  data: TeamUser[];
  total: number;
};

function userName(user: TeamUser): string {
  return user.name || user.email || user.id.substring(0, 8);
}

function taskBarWidth(count: number, max: number): string {
  return max > 0 ? `${(count / max) * 100}%` : "0%";
}

export default function SynergyPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [tasksSummary, setTasksSummary] = useState<TasksSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, tasksRes] = await Promise.all([
        apiRequest<TeamListResponse>("/admin/users"),
        apiRequest<TasksSummaryItem[]>("/admin/users/tasks-summary"),
      ]);
      setUsers(usersRes.data);
      setTasksSummary(tasksRes);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchData(); }, []);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const maxTasks = Math.max(...tasksSummary.map((t) => t.count), 1);

  const rolesDist = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role || "unset"] = (acc[u.role || "unset"] || 0) + 1;
    return acc;
  }, {});

  const totalTasks = tasksSummary.reduce((s, t) => s + t.count, 0);
  const totalPending = tasksSummary.reduce((s, t) => s + t.pending, 0);
  const totalDone = tasksSummary.reduce((s, t) => s + t.done, 0);
  const completionRate = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">
              <Infinity size={20} className="inline mr-2 text-brand-500" /> Synergy
            </h1>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">Team collaboration metrics, task distribution, and activity insights</p>
          </div>
          <button type="button" onClick={() => void fetchData()} className="flex h-9 items-center gap-1.5 rounded-xl border border-white/30 bg-white/70 px-3 text-xs font-medium text-slate-700 transition hover:bg-white/90 dark:border-white/10 dark:bg-black/30 dark:text-slate-300">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw className="animate-spin text-brand-500" size={20} /></div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="glass-card rounded-2xl p-4 animate-fade-up" style={{ animationDelay: "0ms" }}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><Users size={13} /> Team Size</div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{users.length}</p>
              </div>
              <div className="glass-card rounded-2xl p-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><BarChart3 size={13} /> Total Tasks</div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalTasks}</p>
              </div>
              <div className="glass-card rounded-2xl p-4 animate-fade-up" style={{ animationDelay: "160ms" }}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><CheckCircle size={13} /> Completion Rate</div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completionRate}%</p>
              </div>
              <div className="glass-card rounded-2xl p-4 animate-fade-up" style={{ animationDelay: "240ms" }}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><AlertTriangle size={13} /> Pending</div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totalPending}</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="glass-card rounded-2xl animate-fade-up" style={{ animationDelay: "100ms" }}>
                <div className="flex items-center gap-2 border-b border-white/20 px-5 py-4 dark:border-white/10">
                  <BarChart3 size={13} className="text-brand-500" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Task Distribution</span>
                </div>
                <div className="space-y-3 p-5">
                  {tasksSummary.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">No tasks assigned yet.</div>
                  ) : (
                    tasksSummary.map((tsk) => {
                      const user = userMap.get(tsk.assigned_user_id);
                      const displayName = user ? userName(user) : tsk.assigned_user_id.substring(0, 8);
                      return (
                        <div key={tsk.assigned_user_id}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{displayName}</span>
                            <span className="text-slate-500">{tsk.count} tasks</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-indigo-500 transition-all" style={{ width: taskBarWidth(tsk.count, maxTasks) }} />
                          </div>
                          <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
                            <span>{tsk.pending} pending</span>
                            <span>{tsk.done} done</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="glass-card rounded-2xl animate-fade-up" style={{ animationDelay: "180ms" }}>
                <div className="flex items-center gap-2 border-b border-white/20 px-5 py-4 dark:border-white/10">
                  <Activity size={13} className="text-brand-500" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Team Composition</span>
                </div>
                <div className="space-y-3 p-5">
                  {Object.entries(rolesDist).length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">No roles assigned.</div>
                  ) : (
                    Object.entries(rolesDist).sort((a, b) => b[1] - a[1]).map(([role, count]) => {
                      const pct = Math.round((count / users.length) * 100);
                      return (
                        <div key={role}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-semibold capitalize text-slate-700 dark:text-slate-300">{role}</span>
                            <span className="text-slate-500">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl animate-fade-up" style={{ animationDelay: "200ms" }}>
              <div className="flex items-center gap-2 border-b border-white/20 px-5 py-4 dark:border-white/10">
                <Users size={13} className="text-brand-500" />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Team Activity Overview</span>
              </div>
              <div className="divide-y divide-white/10 dark:divide-white/5">
                {users.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-slate-500">No team members yet.</div>
                ) : (
                  users.map((user) => {
                    const tsk = tasksSummary.find((t) => t.assigned_user_id === user.id);
                    return (
                      <div key={user.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-white/30 dark:hover:bg-white/5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-indigo-500 text-[10px] font-bold text-white">
                          {userName(user)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{userName(user)}</p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500">
                            <span><BarChart3 size={10} className="inline" /> {tsk?.count || 0} tasks</span>
                            <span><CheckCircle size={10} className="inline" /> {tsk?.done || 0} done</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </ProtectedPage>
  );
}