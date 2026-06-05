"use client";

import { useEffect, useState } from "react";
import {
  Infinity, BarChart3, Activity, RefreshCw, Users,
  CheckCircle, AlertTriangle, ChevronDown, ChevronUp, UserCheck, Calendar
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ProtectedPage } from "@/components/protected-page";

type DailyStat = {
  date: string;
  assigned: number;
  did: number;
  missed: number;
};

type SynergyEmployeeDetail = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  assigned_count: number;
  touched_count: number;
  untouched_count: number;
  missed_count: number;
  activities_count: number;
  daily_stats: DailyStat[];
};

type SynergySummary = {
  total_assigned: number;
  total_touched: number;
  total_untouched: number;
  total_missed: number;
};

type SynergyReportResponse = {
  summary: SynergySummary;
  employees: SynergyEmployeeDetail[];
};

function userName(emp: SynergyEmployeeDetail): string {
  return emp.name || emp.email || emp.id.substring(0, 8);
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch (e) {
    return dateStr;
  }
}

function getDayName(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  } catch (e) {
    return "";
  }
}

export default function SynergyPage() {
  const [report, setReport] = useState<SynergyReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<SynergyReportResponse>("/admin/synergy-report");
      setReport(res);
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

  const toggleExpand = (id: string) => {
    setExpandedEmployees((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const employees = report?.employees || [];
  const summary = report?.summary || {
    total_assigned: 0,
    total_touched: 0,
    total_untouched: 0,
    total_missed: 0
  };

  const completionRate = summary.total_assigned > 0 
    ? Math.round((summary.total_touched / summary.total_assigned) * 100) 
    : 0;

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
              <Infinity size={22} className="mr-2 text-brand-500 animate-pulse" /> Synergy
            </h1>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Real-time employee activity reports, SLA compliance, and daily work performance.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchData()}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/30 bg-white/70 px-3 text-xs font-medium text-slate-700 transition hover:bg-white/90 dark:border-white/10 dark:bg-black/30 dark:text-slate-300"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="animate-spin text-brand-500" size={24} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Scoped Summary Metrics Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="glass-card rounded-2xl p-4 animate-fade-up bg-white/40 dark:bg-slate-900/40" style={{ animationDelay: "0ms" }}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <Infinity size={13} className="text-brand-500" /> Assigned Leads
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.total_assigned}</p>
                <p className="text-[10px] mt-1 text-slate-400">Total assigned in your scope</p>
              </div>
              <div className="glass-card rounded-2xl p-4 animate-fade-up bg-white/40 dark:bg-slate-900/40" style={{ animationDelay: "80ms" }}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <CheckCircle size={13} className="text-emerald-500" /> Touched ("Did")
                </div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.total_touched}</p>
                <div className="flex items-center justify-between text-[10px] mt-1 text-slate-400">
                  <span>Touched leads rate</span>
                  <span className="font-semibold text-emerald-500">{completionRate}%</span>
                </div>
              </div>
              <div className="glass-card rounded-2xl p-4 animate-fade-up bg-white/40 dark:bg-slate-900/40" style={{ animationDelay: "160ms" }}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <RefreshCw size={13} className="text-amber-500" /> Untouched Leads
                </div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.total_untouched}</p>
                <p className="text-[10px] mt-1 text-slate-400">Awaiting user interaction</p>
              </div>
              <div className="glass-card rounded-2xl p-4 animate-fade-up bg-white/40 dark:bg-slate-900/40" style={{ animationDelay: "240ms" }}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <AlertTriangle size={13} className="text-rose-500" /> SLA Breached ("Missed")
                </div>
                <p className={`text-2xl font-bold ${summary.total_missed > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                  {summary.total_missed}
                </p>
                <p className="text-[10px] mt-1 text-slate-400">Touch or stage SLA expired</p>
              </div>
            </div>

            {/* Employee Performance Overview Card */}
            <div className="glass-card rounded-2xl overflow-hidden animate-fade-up bg-white/40 dark:bg-slate-900/40" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center justify-between border-b border-white/20 px-6 py-4 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-brand-500" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Employee Work Details</span>
                </div>
                <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-600 dark:text-brand-400 font-medium">
                  {employees.length} members
                </span>
              </div>

              {employees.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-slate-500">
                  No employee work details found in your scope.
                </div>
              ) : (
                <div className="divide-y divide-white/10 dark:divide-white/5">
                  {employees.map((emp) => {
                    const isExpanded = expandedEmployees[emp.id];
                    return (
                      <div key={emp.id} className="transition hover:bg-white/10 dark:hover:bg-white/5">
                        {/* Main Employee Row */}
                        <div 
                          className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 cursor-pointer"
                          onClick={() => toggleExpand(emp.id)}
                        >
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-indigo-500 text-xs font-bold text-white shadow-md">
                              {userName(emp)[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {userName(emp)}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{emp.email || "No email"}</span>
                                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">
                                  {emp.role || "staff"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Stats Grid */}
                          <div className="grid grid-cols-4 gap-4 md:gap-8 text-center shrink-0">
                            <div>
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Assigned</p>
                              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{emp.assigned_count}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Did</p>
                              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{emp.touched_count}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Untouched</p>
                              <p className="text-sm font-bold text-amber-500 mt-0.5">{emp.untouched_count}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Missed</p>
                              <p className={`text-sm font-bold mt-0.5 ${emp.missed_count > 0 ? "text-rose-500 font-black" : "text-slate-900 dark:text-white"}`}>
                                {emp.missed_count}
                              </p>
                            </div>
                          </div>

                          {/* Toggle expand button */}
                          <div className="flex items-center gap-2">
                            <span className="hidden sm:inline text-[10px] text-slate-400 font-medium">
                              {emp.activities_count} activities
                            </span>
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-white/30 text-slate-500 transition hover:bg-white/50 dark:border-white/5 dark:bg-black/20 dark:text-slate-400"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Daily breakdown details */}
                        {isExpanded && (
                          <div className="bg-slate-50/50 dark:bg-slate-950/20 px-6 py-4 border-t border-slate-100 dark:border-slate-800 animate-fade-down">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                              <Calendar size={13} className="text-brand-500" />
                              <span>7-Day Daily Activity Breakdown</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
                              {emp.daily_stats.map((day) => {
                                const isToday = new Date(day.date).toDateString() === new Date().toDateString();
                                return (
                                  <div 
                                    key={day.date} 
                                    className={`rounded-xl p-3 border text-center transition hover:scale-[1.02] ${
                                      isToday 
                                        ? "bg-brand-500/5 border-brand-500/30 dark:bg-brand-500/10" 
                                        : "bg-white/40 border-slate-100 dark:bg-slate-900/20 dark:border-slate-800"
                                    }`}
                                  >
                                    <p className="text-[10px] uppercase font-bold text-slate-400">{getDayName(day.date)}</p>
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{formatDate(day.date)}</p>
                                    <div className="mt-2.5 space-y-1.5 text-[10px]">
                                      <div className="flex items-center justify-between rounded px-1 py-0.5 bg-brand-500/5 dark:bg-brand-500/10">
                                        <span className="text-slate-400">Assigned</span>
                                        <span className="font-semibold text-brand-600 dark:text-brand-400">+{day.assigned}</span>
                                      </div>
                                      <div className="flex items-center justify-between rounded px-1 py-0.5 bg-emerald-500/5 dark:bg-emerald-500/10">
                                        <span className="text-slate-400">Did</span>
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{day.did}</span>
                                      </div>
                                      <div className="flex items-center justify-between rounded px-1 py-0.5 bg-rose-500/5 dark:bg-rose-500/10">
                                        <span className="text-slate-400">Missed</span>
                                        <span className={`font-semibold ${day.missed > 0 ? "text-rose-500" : "text-slate-500"}`}>{day.missed}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </ProtectedPage>
  );
}