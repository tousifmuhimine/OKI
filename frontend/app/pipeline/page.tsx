"use client";

import { useEffect, useState, useCallback } from "react";
import { ProtectedPage } from "@/components/protected-page";
import {
  Plus, TrendingUp, Search, Filter, MoreHorizontal,
  Calendar, Building2, User, Globe, RefreshCw, X,
  Loader2, CheckCircle2, Trophy,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────
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

type OpportunityListResponse = {
  data: Opportunity[];
  meta: { total: number; limit: number; offset: number };
};

// ─── Stage Config ────────────────────────────────────────────────
const stages = [
  { key: "discovery",    label: "Discovery",    tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-500/30" },
  { key: "proposal",     label: "Proposal",     tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30" },
  { key: "negotiation",  label: "Negotiation",  tone: "bg-purple-500/15 text-purple-700 dark:text-purple-300 ring-purple-500/30" },
  { key: "won",          label: "Closed Won",   tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30" },
  { key: "lost",         label: "Closed Lost",  tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-slate-500/30" },
];

// ─── Currency ────────────────────────────────────────────────────
const exchangeRates: Record<string, number> = {
  BDT: 1, USD: 0.0091, AED: 0.033, CNY: 0.066, EUR: 0.0083, GBP: 0.0071,
};
const currencyOptions = [
  { code: "BDT", label: "BDT - Taka" },
  { code: "USD", label: "USD - Dollar" },
  { code: "AED", label: "AED - Dirham" },
  { code: "CNY", label: "CNY - Yuan" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "GBP", label: "GBP - Pound" },
];

export default function PipelinePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("BDT");
  const [search, setSearch] = useState("");
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // New Deal form state
  const [newTitle, setNewTitle] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newStage, setNewStage] = useState("discovery");
  const [creating, setCreating] = useState(false);

  const formatCurrency = (bdtValue: number) => {
    const safe = isNaN(bdtValue) ? 0 : bdtValue;
    const rate = exchangeRates[currency] || 1;
    const converted = safe * rate;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 0,
    }).format(converted);
  };

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<OpportunityListResponse>("/opportunities?limit=200&offset=0");
      setOpportunities(res.data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOpportunities(); }, [loadOpportunities]);

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

    // Optimistic update
    setOpportunities(prev => prev.map(o => o.id === id ? { ...o, stage: stageKey } : o));
    setDraggedId(null);
    setSaving(id);
    try {
      await apiRequest(`/opportunities/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ stage: stageKey }),
      });
    } catch {
      // Revert on failure
      setOpportunities(prev => prev.map(o => o.id === id ? { ...o, stage: opp.stage } : o));
    } finally {
      setSaving(null);
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCustomerId.trim()) return;
    setCreating(true);
    try {
      const created = await apiRequest<Opportunity>("/opportunities", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          customer_id: newCustomerId,
          stage: newStage,
          estimated_value: parseFloat(newValue) || 0,
          currency: "BDT",
        }),
      });
      setOpportunities(prev => [created, ...prev]);
      setShowNewDeal(false);
      setNewTitle(""); setNewCustomerId(""); setNewValue(""); setNewStage("discovery");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // ─── Computed KPIs ────────────────────────────────────────────
  const filtered = opportunities.filter(o => {
    const q = search.trim().toLowerCase();
    return !q || o.title.toLowerCase().includes(q) || o.customer_id.toLowerCase().includes(q);
  }).map(o => ({ ...o, estimated_value: parseFloat(String(o.estimated_value)) || 0 }));

  const totalPipeline = filtered.filter(o => o.stage !== "lost").reduce((acc, o) => acc + o.estimated_value, 0);
  const activeDeals = filtered.filter(o => o.stage !== "won" && o.stage !== "lost").length;
  const wonValue = filtered.filter(o => o.stage === "won").reduce((acc, o) => acc + o.estimated_value, 0);
  const wonCount = filtered.filter(o => o.stage === "won").length;
  const closedCount = filtered.filter(o => o.stage === "won" || o.stage === "lost").length;
  const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] overflow-x-clip bg-transparent px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
        <div className="mx-auto w-full max-w-screen-2xl min-w-0 animate-fade-up">

          {/* Header */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">
                <TrendingUp size={14} /> Sales Pipeline
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Opportunities</h1>
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
                onClick={() => setShowNewDeal(true)}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-4 text-sm font-semibold text-white shadow-glow-sm transition hover:from-brand-400 hover:to-indigo-500 active:scale-95"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">New Deal</span>
              </button>
            </div>
          </div>

          {error && (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          )}

          {/* KPI Summary — live data */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Total Pipeline Value", value: formatCurrency(totalPipeline), color: "text-brand-500" },
              { label: "Active Deals", value: activeDeals.toString(), color: "text-amber-500" },
              { label: "Won Value", value: formatCurrency(wonValue), color: "text-emerald-500" },
              { label: "Win Rate", value: `${winRate}%`, color: "text-cyan-500" },
            ].map((kpi, idx) => (
              <div key={idx} className="glass-card p-4 transition hover:bg-white/40 dark:hover:bg-white/5">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{kpi.label}</p>
                <p className={`mt-2 text-2xl font-bold sm:text-3xl ${kpi.color}`}>{kpi.value}</p>
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
                    className="glass-card flex min-w-[300px] flex-col rounded-2xl bg-white/20 p-3 dark:bg-black/10"
                    onDragOver={handleDragOver}
                    onDrop={e => void handleDrop(e, stage.key)}
                  >
                    <div className="mb-4 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 inset-ring ${stage.tone}`}>
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
                          <span className="text-[11px] text-slate-400">Drop here</span>
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
            <div className="glass-card flex flex-col items-center justify-center gap-4 py-20 text-center">
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
        </div>
      </section>

      {/* ─── New Deal Modal ──────────────────────────────────────── */}
      {showNewDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/90 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-fade-up">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Deal</h2>
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
                  placeholder="e.g. Enterprise Software License"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Customer ID *</label>
                <input
                  required
                  value={newCustomerId}
                  onChange={e => setNewCustomerId(e.target.value)}
                  placeholder="Customer ID (from customers list)"
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
    </ProtectedPage>
  );
}
