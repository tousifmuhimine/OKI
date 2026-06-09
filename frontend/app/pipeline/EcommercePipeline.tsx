"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp, Search, Calendar, Building2, Globe, RefreshCw, X, Loader2, CheckCircle2, ChevronRight, Upload, FileText, Trash2, ShieldAlert, Plus
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

interface EcommercePipelineProps {
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

const ecommerceStagesList = [
  { key: "lead_gen", label: "Lead Gen" },
  { key: "pitch", label: "Pitch" },
  { key: "kyc_verification", label: "KYC Verification" },
  { key: "sla_negotiation", label: "SLA Negotiation" },
  { key: "cataloging", label: "Cataloging" },
  { key: "live", label: "Live" }
];

export function EcommercePipeline({
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
}: EcommercePipelineProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [dropping, setDropping] = useState(false);

  // New Merchant Modal State
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newValue, setNewValue] = useState("");
  const [creating, setCreating] = useState(false);

  // Active Opportunity
  const activeOpp = opportunities.find(o => o.id === selectedId) || null;

  // Sync selectedId with first opportunity if not set
  useEffect(() => {
    if (opportunities.length > 0 && !selectedId) {
      setSelectedId(opportunities[0].id);
    }
  }, [opportunities, selectedId]);

  // Load documents when active opportunity changes
  useEffect(() => {
    if (activeOpp) {
      void loadDocs(activeOpp.customer_id);
    } else {
      setDocuments([]);
    }
  }, [selectedId]);

  const loadDocs = async (customerId: string) => {
    setDocsLoading(true);
    try {
      const docs = await apiRequest<any[]>(`/documents?customer_id=${customerId}`);
      setDocuments(docs);
    } catch {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleFileUpload = async (type: string, file: File) => {
    if (!activeOpp) return;
    setUploadingType(type);
    try {
      const formData = new FormData();
      formData.append("file_type", type);
      formData.append("customer_id", activeOpp.customer_id);
      formData.append("file", file);

      await apiRequest("/documents/upload", {
        method: "POST",
        body: formData,
      });
      await loadDocs(activeOpp.customer_id);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploadingType(null);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!activeOpp) return;
    const ok = window.confirm("Are you sure you want to delete this document?");
    if (!ok) return;
    try {
      await apiRequest(`/documents/${docId}`, { method: "DELETE" });
      await loadDocs(activeOpp.customer_id);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleAdvance = async () => {
    if (!activeOpp) return;
    const currentIdx = ecommerceStagesList.findIndex(s => s.key === activeOpp.stage);
    if (currentIdx === -1 || currentIdx === ecommerceStagesList.length - 1) return;

    const nextStage = ecommerceStagesList[currentIdx + 1];
    setAdvancing(true);
    try {
      await apiRequest(`/opportunities/${activeOpp.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stage: nextStage.label }),
      });
      await loadOpportunities();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setAdvancing(false);
    }
  };

  const handleDrop = async () => {
    if (!activeOpp) return;
    const ok = window.confirm("Are you sure you want to drop this merchant lead?");
    if (!ok) return;
    setDropping(true);
    try {
      await apiRequest(`/opportunities/${activeOpp.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stage: "Dropped" }),
      });
      await loadOpportunities();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDropping(false);
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCustomerId.trim()) return;
    setCreating(true);
    try {
      const created = await apiRequest<any>("/opportunities", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          customer_id: newCustomerId,
          stage: "Lead Gen",
          estimated_value: parseFloat(newValue) || 0,
          currency: "BDT",
        }),
      });

      setShowNewDeal(false);
      setNewTitle(""); setNewCustomerId(""); setNewValue("");
      await loadOpportunities();
      setSelectedId(created.id);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const getFullFileUrl = (relativeUrl: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";
    const host = apiBase.replace("/api/v1", "");
    return `${host}${relativeUrl}`;
  };

  const filtered = opportunities.filter(o => {
    const q = search.trim().toLowerCase();
    return !q || o.title.toLowerCase().includes(q) || o.customer_id.toLowerCase().includes(q);
  });

  const getStageDisplayIndex = (stageKey: string) => {
    return ecommerceStagesList.findIndex(s => s.key === stageKey);
  };

  const activeIdx = activeOpp ? getStageDisplayIndex(activeOpp.stage) : -1;
  const isDropped = activeOpp?.stage === "dropped";

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">
            <TrendingUp size={14} /> Merchant Onboarding
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white font-outfit">Merchant Sales Pipeline</h1>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto flex-wrap sm:flex-nowrap">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/50 bg-white/50 px-3 dark:border-white/10 dark:bg-black/20 sm:min-w-[200px]">
            <Search size={15} className="text-slate-500" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
              placeholder="Search merchants..."
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
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
            <span className="hidden sm:inline">New Merchant</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      {loading && opportunities.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-brand-500" />
          <span className="ml-3 text-sm text-slate-500">Loading merchant leads…</span>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center gap-4 py-20 text-center rounded-3xl border border-white/20 dark:border-slate-800 bg-white/20 dark:bg-slate-900/10 max-w-lg mx-auto">
          <Building2 size={48} className="text-brand-400 dark:text-brand-600 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white font-outfit font-bold">No Merchant Onboarding Leads</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            Start onboarding by registering a merchant lead.
          </p>
          <button
            onClick={() => setShowNewDeal(true)}
            className="mt-2 flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-5 text-sm font-semibold text-white shadow-glow"
          >
            <Plus size={16} /> Register First Merchant
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row min-h-[500px]">
          {/* Left Panel: Merchant List */}
          <div className="w-full lg:w-1/3 flex flex-col gap-3 max-h-[700px] overflow-y-auto pr-1">
            {filtered.map(opp => {
              const isActive = opp.id === selectedId;
              const isLeadDropped = opp.stage === "dropped";
              return (
                <button
                  key={opp.id}
                  onClick={() => setSelectedId(opp.id)}
                  className={`group text-left p-4 rounded-2xl border transition-all ${
                    isActive
                      ? "bg-slate-900 border-slate-900 text-white shadow-xl dark:bg-white/10 dark:border-white/20"
                      : "bg-white/40 border-white/50 hover:bg-white/80 dark:bg-slate-900/20 dark:border-slate-800/50 dark:hover:bg-slate-900/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${
                      isActive
                        ? "bg-amber-400 text-slate-950 font-black shadow-sm"
                        : isLeadDropped
                        ? "bg-rose-500/10 text-rose-500"
                        : opp.stage === "live"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                    }`}>
                      {opp.stage.replace("_", " ")}
                    </span>
                    <span className={`text-xs font-bold ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                      {formatCurrency(opp.estimated_value)}
                    </span>
                  </div>
                  <h3 className={`font-bold text-sm leading-tight ${isActive ? "text-white" : "text-slate-900 dark:text-white"}`}>
                    {opp.title}
                  </h3>
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] opacity-60">
                    <Building2 size={12} />
                    <span className="font-mono">{opp.customer_id.substring(0, 15)}...</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Panel: Inspection View */}
          <div className="flex-1 glass-card border border-white/20 dark:border-slate-800 rounded-3xl bg-white/20 dark:bg-slate-900/10 p-6 flex flex-col gap-6">
            {activeOpp ? (
              <>
                {/* Chevron Progression Indicator */}
                <div className="overflow-x-auto pb-2 hide-scrollbar">
                  <div className="flex items-center min-w-[650px] bg-slate-950/5 dark:bg-black/10 rounded-2xl p-1.5">
                    {ecommerceStagesList.map((step, idx) => {
                      const isCompleted = activeIdx > idx && !isDropped;
                      const isCurrent = activeIdx === idx && !isDropped;
                      return (
                        <div key={step.key} className="flex-1 flex items-center">
                          <div className="flex-1 text-center py-2 px-1 relative">
                            <span className={`block text-[11px] font-bold tracking-tight transition-colors ${
                              isCurrent
                                ? "text-brand-600 dark:text-brand-400 font-extrabold"
                                : isCompleted
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-400 dark:text-slate-600"
                            }`}>
                              {step.label}
                            </span>
                            {isCurrent && (
                              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-1 bg-brand-500 rounded-full" />
                            )}
                            {isCompleted && (
                              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-1 bg-emerald-500 rounded-full" />
                            )}
                          </div>
                          {idx < ecommerceStagesList.length - 1 && (
                            <ChevronRight size={14} className="text-slate-300 dark:text-slate-700 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Status Bar */}
                {isDropped && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300">
                    <ShieldAlert size={20} className="shrink-0 animate-pulse" />
                    <div>
                      <p className="text-sm font-bold">Merchant Lead Dropped</p>
                      <p className="text-xs opacity-80">This merchant boarding was discontinued. You can restart it by advancing stages.</p>
                    </div>
                  </div>
                )}

                {/* Deal Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/50 dark:border-slate-800 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">{activeOpp.title}</h2>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <span>Customer Reference:</span>
                      <span className="font-mono bg-slate-200/50 dark:bg-white/5 px-1.5 py-0.5 rounded">{activeOpp.customer_id}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider font-outfit">Estimated Value</span>
                    <span className="text-2xl font-black text-brand-600 dark:text-brand-400">{formatCurrency(activeOpp.estimated_value)}</span>
                  </div>
                </div>

                {/* Actions Panel */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleAdvance}
                    disabled={isDropped || activeIdx === ecommerceStagesList.length - 1 || advancing}
                    className="flex-1 min-w-[150px] h-12 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-sm font-semibold text-white shadow-glow-sm hover:from-emerald-400 hover:to-teal-500 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none font-outfit"
                  >
                    {advancing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {activeIdx === ecommerceStagesList.length - 1 ? "Completed Onboarding" : "Advance Merchant Stage"}
                  </button>

                  <button
                    onClick={handleDrop}
                    disabled={isDropped || dropping}
                    className="h-12 px-6 flex items-center justify-center gap-2 rounded-2xl border border-rose-200 hover:border-rose-300 bg-rose-500/5 hover:bg-rose-500/10 text-sm font-semibold text-rose-600 transition active:scale-95 disabled:opacity-40 font-outfit"
                  >
                    {dropping ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                    Drop Merchant
                  </button>
                </div>

                {/* File Viewer Section */}
                <div className="mt-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2 font-outfit">
                    <FileText size={16} className="text-brand-500" />
                    Required Onboarding Documents
                  </h3>

                  {docsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 size={20} className="animate-spin text-brand-500" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                      {/* Trade License */}
                      <div className="border border-white/40 dark:border-slate-800/80 bg-white/30 dark:bg-white/5 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 font-outfit">Trade License</h4>
                          <span className="text-[10px] text-slate-400 font-medium">PDF/Images</span>
                        </div>

                        {/* File list */}
                        <div className="space-y-2 flex-1">
                          {documents.filter(d => d.file_type === "trade_license").map(doc => (
                            <div key={doc.id} className="flex items-center justify-between gap-2 p-2 bg-white/40 dark:bg-slate-900/35 rounded-xl border border-white/20">
                              <span className="text-xs font-semibold truncate max-w-[150px]" title={doc.name}>{doc.name}</span>
                              <div className="flex gap-1">
                                <a href={getFullFileUrl(doc.file_url)} target="_blank" rel="noreferrer" className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded text-slate-600 dark:text-slate-300">
                                  <FileText size={13} />
                                </a>
                                <button onClick={() => handleDeleteDoc(doc.id)} className="p-1 hover:bg-rose-500/20 rounded text-rose-500">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {documents.filter(d => d.file_type === "trade_license").length === 0 && (
                            <p className="text-xs text-slate-400 italic py-3 text-center">No trade license uploaded.</p>
                          )}
                        </div>

                        {/* Upload trigger */}
                        <label className="h-10 border border-dashed border-slate-300 hover:border-brand-400 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition text-xs font-bold text-slate-600 dark:text-slate-300 bg-white/20 hover:bg-white/50">
                          {uploadingType === "trade_license" ? (
                            <Loader2 size={14} className="animate-spin text-brand-500" />
                          ) : (
                            <Upload size={14} />
                          )}
                          Upload Trade License
                          <input
                            type="file"
                            disabled={uploadingType !== null}
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) void handleFileUpload("trade_license", file);
                            }}
                          />
                        </label>
                      </div>

                      {/* National ID (NID) */}
                      <div className="border border-white/40 dark:border-slate-800/80 bg-white/30 dark:bg-white/5 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 font-outfit">National ID (NID)</h4>
                          <span className="text-[10px] text-slate-400 font-medium">PDF/Images</span>
                        </div>

                        {/* File list */}
                        <div className="space-y-2 flex-1">
                          {documents.filter(d => d.file_type === "nid").map(doc => (
                            <div key={doc.id} className="flex items-center justify-between gap-2 p-2 bg-white/40 dark:bg-slate-900/35 rounded-xl border border-white/20">
                              <span className="text-xs font-semibold truncate max-w-[150px]" title={doc.name}>{doc.name}</span>
                              <div className="flex gap-1">
                                <a href={getFullFileUrl(doc.file_url)} target="_blank" rel="noreferrer" className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded text-slate-600 dark:text-slate-300">
                                  <FileText size={13} />
                                </a>
                                <button onClick={() => handleDeleteDoc(doc.id)} className="p-1 hover:bg-rose-500/20 rounded text-rose-500">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {documents.filter(d => d.file_type === "nid").length === 0 && (
                            <p className="text-xs text-slate-400 italic py-3 text-center">No NID uploaded.</p>
                          )}
                        </div>

                        {/* Upload trigger */}
                        <label className="h-10 border border-dashed border-slate-300 hover:border-brand-400 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition text-xs font-bold text-slate-600 dark:text-slate-300 bg-white/20 hover:bg-white/50">
                          {uploadingType === "nid" ? (
                            <Loader2 size={14} className="animate-spin text-brand-500" />
                          ) : (
                            <Upload size={14} />
                          )}
                          Upload NID Document
                          <input
                            type="file"
                            disabled={uploadingType !== null}
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) void handleFileUpload("nid", file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500">
                <Building2 size={32} className="opacity-40 mb-2" />
                <p className="text-sm font-semibold">Select a merchant lead to view details.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Merchant Modal */}
      {showNewDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/90 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-fade-up">
            <div className="mb-5 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">Register Merchant</h2>
              <button onClick={() => setShowNewDeal(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateDeal} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Merchant/Deal Title *</label>
                <input
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Acme Corp Onboarding"
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
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Estimated Value (BDT)</label>
                <input
                  type="number"
                  min="0"
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  placeholder="0"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewDeal(false)}
                  className="flex-1 h-11 rounded-xl border border-slate-200 bg-white/60 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-sm font-semibold text-white shadow-glow-sm hover:from-brand-400 hover:to-indigo-500 active:scale-95 disabled:opacity-60"
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {creating ? "Creating…" : "Register Merchant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
