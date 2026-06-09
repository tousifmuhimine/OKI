"use client";

import { useState } from "react";
import {
  Plus, TrendingUp, Search, Calendar, Building2, Globe, RefreshCw, X, Loader2, CheckCircle2, Trophy
} from "lucide-react";
import { apiRequest } from "@/lib/api";

type Opportunity = {
  id: string;
  customer_id: string;
  title: string;
  stage: string;
  estimated_value: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

interface StudyAbroadPipelineProps {
  stages: { key: string; label: string; tone: string }[];
  opportunities: Opportunity[];
  loading: boolean;
  error: string | null;
  loadOpportunities: () => Promise<void>;
  formatCurrency: (val: number) => string;
  currency: string;
  setCurrency: (val: string) => void;
  search: string;
  setSearch: (val: string) => void;
}

const currencyOptions = [
  { code: "BDT", label: "BDT - Taka" },
  { code: "USD", label: "USD - Dollar" },
  { code: "AED", label: "AED - Dirham" },
  { code: "CNY", label: "CNY - Yuan" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "GBP", label: "GBP - Pound" },
];

export function StudyAbroadPipeline({
  stages,
  opportunities,
  loading,
  error,
  loadOpportunities,
  formatCurrency,
  currency,
  setCurrency,
  search,
  setSearch,
}: StudyAbroadPipelineProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // New Deal form state
  const [newTitle, setNewTitle] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newStage, setNewStage] = useState("");

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedId(id);
  };

  const handleDragEnd = () => setDraggedId(null);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) { setDraggedId(null); return; }
    const opp = opportunities.find(o => o.id === id);
    if (!opp || opp.stage === stageKey) { setDraggedId(null); return; }

    const targetStage = stages.find(s => s.key === stageKey);
    const dbStageName = targetStage ? targetStage.label : stageKey;

    // Optimistic update
    opp.stage = stageKey;
    setDraggedId(null);
    setSaving(id);
    try {
      await apiRequest(`/opportunities/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ stage: dbStageName }),
      });
      await loadOpportunities();
    } catch {
      await loadOpportunities();
    } finally {
      setSaving(null);
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCustomerId.trim()) return;
    setCreating(true);
    try {
      const activeStage = newStage || (stages[0]?.key ?? "discovery");
      const targetStage = stages.find(s => s.key === activeStage);
      const dbStageName = targetStage ? targetStage.label : activeStage;

      await apiRequest("/opportunities", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          customer_id: newCustomerId,
          stage: dbStageName,
          estimated_value: parseFloat(newValue) || 0,
          currency: "BDT",
        }),
      });

      setShowNewDeal(false);
      setNewTitle(""); setNewCustomerId(""); setNewValue(""); setNewStage(stages[0]?.key ?? "");
      await loadOpportunities();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const filtered = opportunities.filter(o => {
    const q = search.trim().toLowerCase();
    return !q || o.title.toLowerCase().includes(q) || o.customer_id.toLowerCase().includes(q);
  });

  const totalPipeline = filtered.filter(o => o.stage !== "lost").reduce((acc, o) => acc + o.estimated_value, 0);
  const activeDeals = filtered.filter(o => o.stage !== "won" && o.stage !== "lost").length;
  const wonValue = filtered.filter(o => o.stage === "won").reduce((acc, o) => acc + o.estimated_value, 0);
  const wonCount = filtered.filter(o => o.stage === "won").length;
  const closedCount = filtered.filter(o => o.stage === "won" || o.stage === "lost").length;
  const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">
            <TrendingUp size={14} /> Sales Pipeline
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white font-outfit">Opportunities</h1>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto flex-wrap sm:flex-nowrap">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/50 bg-white/50 px-3 dark:border-white/10 dark:bg-black/20 sm:min-w-[200px]">
            <Search size={15} className="text-slate-500" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
              placeholder="Search opportunities..."
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Currency Toggle */}
          <div className="relative flex h-10 items-center rounded-xl border border-white/50 bg-white/50 px-3 dark:border-white/10 dark:bg-black/20">
            <Globe size={15} className="mr-2 text-slate-500" />
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="appearance-none bg-transparent text-sm font-semibold text-slate-700 outline-none dark:text-slate-200 pr-4 cursor-pointer"
            >
              {currencyOptions.map(opt => (
                <option key={opt.code} value={opt.code} className="text-slate-900 bg-white dark:bg-slate-800 dark:text-white">
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
              <svg className="h-3 w-3 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
            </div>
          </div>

          <button
            onClick={() => void loadOpportunities()}
            className="glass-panel flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-700 transition hover:bg-white/60 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => {
              if (stages.length > 0) setNewStage(stages[0].key);
              setShowNewDeal(true);
            }}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-4 text-sm font-semibold text-white shadow-glow-sm transition hover:from-brand-400 hover:to-indigo-500 active:scale-95"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Deal</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 animate-shake">
          {error}
        </p>
      )}

      {/* KPI Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total Pipeline Value", value: formatCurrency(totalPipeline), color: "text-brand-500" },
          { label: "Active Deals", value: activeDeals.toString(), color: "text-amber-500" },
          { label: "Won Value", value: formatCurrency(wonValue), color: "text-emerald-500" },
          { label: "Win Rate", value: `${winRate}%`, color: "text-cyan-500" },
        ].map((kpi, idx) => (
          <div key={idx} className="glass-card p-4 transition hover:bg-white/40 dark:hover:bg-white/5 border border-white/20 dark:border-slate-800/80 rounded-2xl">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{kpi.label}</p>
            <p className={`mt-2 text-2xl font-black font-outfit sm:text-3xl ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-brand-500" />
          <span className="ml-3 text-sm text-slate-500">Loading opportunities…</span>
        </div>
      )}

      {/* Kanban Board */}
      {!loading && (
        <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
          {stages.map(stage => {
            const stageOpps = filtered.filter(o => o.stage === stage.key);
            const stageTotalBDT = stageOpps.reduce((acc, curr) => acc + curr.estimated_value, 0);
            return (
              <div
                key={stage.key}
                className="glass-card flex min-w-[300px] flex-col rounded-2xl bg-white/25 p-3 dark:bg-slate-900/20 border border-white/20 dark:border-slate-800/50"
                onDragOver={handleDragOver}
                onDrop={e => void handleDrop(e, stage.key)}
              >
                <div className="mb-4 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider ring-1 ${stage.tone}`}>
                      {stage.label}
                    </span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200/50 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {stageOpps.length}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {formatCurrency(stageTotalBDT)}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 min-h-[150px]">
                  {stageOpps.map(opp => (
                    <div
                      key={opp.id}
                      draggable
                      onDragStart={e => handleDragStart(e, opp.id)}
                      onDragEnd={handleDragEnd}
                      className={`group relative cursor-grab rounded-xl border border-white/50 bg-white/60 p-4 shadow-sm backdrop-blur-md transition-all active:cursor-grabbing dark:border-white/10 dark:bg-slate-900/40 hover:shadow-md hover:border-brand-300 dark:hover:border-brand-500/30 ${draggedId === opp.id ? "opacity-40 scale-95" : ""}`}
                    >
                      {saving === opp.id && (
                        <div className="absolute right-3 top-3">
                          <Loader2 size={12} className="animate-spin text-brand-500" />
                        </div>
                      )}
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold leading-tight text-slate-900 dark:text-white line-clamp-2">
                          {opp.title}
                        </h3>
                        {opp.stage === "won" && <Trophy size={12} className="text-emerald-500 shrink-0" />}
                      </div>

                      <div className="mb-3 text-lg font-black text-brand-600 dark:text-brand-400">
                        {formatCurrency(opp.estimated_value)}
                      </div>

                      <div className="space-y-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={12} className="text-slate-400" />
                          <span className="truncate font-mono text-[10px] opacity-60">{opp.customer_id.slice(0, 12)}…</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-slate-400" />
                          <span>
                            {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(opp.created_at))}
                          </span>
                        </div>
                      </div>

                      <div className="absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100 bg-gradient-to-r from-brand-500/20 to-indigo-500/20 pointer-events-none -z-10 blur-sm" />
                    </div>
                  ))}
                  {stageOpps.length === 0 && (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300/50 bg-white/10 dark:border-white/10 dark:bg-transparent min-h-[100px]">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Drop here</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center gap-4 py-20 text-center rounded-2xl border border-white/20">
          <CheckCircle2 size={40} className="text-brand-300 dark:text-brand-600" />
          <p className="text-base font-semibold text-slate-600 dark:text-slate-300">No opportunities yet</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">Convert a lead or create a deal to get started.</p>
          <button
            onClick={() => setShowNewDeal(true)}
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-4 text-sm font-semibold text-white shadow-glow-sm"
          >
            <Plus size={15} /> New Deal
          </button>
        </div>
      )}

      {/* New Deal Modal */}
      {showNewDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/90 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-fade-up">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">New Deal</h2>
              <button onClick={() => setShowNewDeal(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateDeal} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Deal Title *</label>
                <input
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Student Application Assistance"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Customer ID *</label>
                <input
                  required
                  value={newCustomerId}
                  onChange={e => setNewCustomerId(e.target.value)}
                  placeholder="Customer ID"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Value (BDT)</label>
                  <input
                    type="number"
                    min="0"
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder="0"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Stage</label>
                  <select
                    value={newStage}
                    onChange={e => setNewStage(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                  >
                    {stages.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewDeal(false)}
                  className="flex-1 h-11 rounded-xl border border-slate-200 bg-white/60 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-sm font-semibold text-white shadow-glow-sm hover:from-brand-400 hover:to-indigo-500 active:scale-95 disabled:opacity-60"
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {creating ? "Creating…" : "Create Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
