"use client";

import { useState } from "react";
import {
  TrendingUp, Search, RefreshCw, X, Loader2, CheckCircle2, MessageSquare, Phone, Building, Calendar, DollarSign, Send, Landmark, Plus, Home
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
  industry_data?: {
    project_name?: string;
    whatsapp_sent_count?: number;
  } | null;
};

interface RealEstatePipelineProps {
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

const realEstateTabs = [
  { key: "all", label: "All Leads" },
  { key: "inquiry", label: "Inquiry" },
  { key: "site_visits_booked", label: "Site Visits Booked" },
  { key: "deed_legal_review", label: "Deed/Legal Review" },
  { key: "financing_installments", label: "Financing/Installments" },
  { key: "registration", label: "Registration" }
];

const messageTemplates = [
  {
    id: "visit",
    title: "Site Visit Confirmation",
    text: "Dear Client, your site visit to [ProjectName] is scheduled for tomorrow at 11:00 AM. Our field agent will assist you. Let us know if you need pick-up arrangements. Regards, Oki Real Estate."
  },
  {
    id: "legal",
    title: "Deed & Legal Document Request",
    text: "Dear Client, we have initiated the Deed & Legal Review for your booking in [ProjectName]. Please share your updated NID and Tax clearance certificate. Regards, Oki Real Estate."
  },
  {
    id: "payment",
    title: "Installment Reminder",
    text: "Dear Client, this is a friendly reminder that the next installment for your plot/apartment in [ProjectName] is due by next week. Let us know if you need financing support. Regards, Oki Real Estate."
  },
  {
    id: "register",
    title: "Registration Completion Update",
    text: "Dear Client, we are happy to inform you that your registration papers for [ProjectName] are ready. We look forward to hand over the physical deeds soon. Regards, Oki Real Estate."
  }
];

const getTemplateIcon = (id: string) => {
  switch (id) {
    case "visit":
      return <Calendar size={16} />;
    case "legal":
      return <Landmark size={16} />;
    case "payment":
      return <DollarSign size={16} />;
    case "register":
      return <CheckCircle2 size={16} />;
    default:
      return <MessageSquare size={16} />;
  }
};

export function RealEstatePipeline({
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
}: RealEstatePipelineProps) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  
  // New Deal Modal State
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newStage, setNewStage] = useState("");
  const [creating, setCreating] = useState(false);

  // WhatsApp Modal State
  const [whatsappOppId, setWhatsappOppId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("visit");
  const [whatsappMsgText, setWhatsappMsgText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Group opportunities by physical project name stored in industry_data
  const opportunitiesByProject: Record<string, Opportunity[]> = {};
  opportunities.forEach(opp => {
    const projName = opp.industry_data?.project_name || "General Projects";
    if (!opportunitiesByProject[projName]) {
      opportunitiesByProject[projName] = [];
    }
    opportunitiesByProject[projName].push(opp);
  });

  const projects = Object.keys(opportunitiesByProject).map(name => {
    const opps = opportunitiesByProject[name];
    const totalVal = opps.reduce((acc, curr) => acc + curr.estimated_value, 0);
    return { name, opportunities: opps, totalValue: totalVal };
  });

  const handleOpenWhatsAppModal = (opp: Opportunity) => {
    setWhatsappOppId(opp.id);
    const projName = opp.industry_data?.project_name || "General Projects";
    const template = messageTemplates.find(t => t.id === "visit");
    if (template) {
      setWhatsappMsgText(template.text.replace("[ProjectName]", projName));
    }
    setSelectedTemplateId("visit");
  };

  const handleTemplateChange = (tid: string, opp: Opportunity) => {
    setSelectedTemplateId(tid);
    const projName = opp.industry_data?.project_name || "General Projects";
    const template = messageTemplates.find(t => t.id === tid);
    if (template) {
      setWhatsappMsgText(template.text.replace("[ProjectName]", projName));
    }
  };

  const handleSendWhatsApp = async () => {
    if (!whatsappOppId) return;
    const opp = opportunities.find(o => o.id === whatsappOppId);
    if (!opp) return;

    setSendingMsg(true);
    try {
      const currentCount = opp.industry_data?.whatsapp_sent_count || 0;
      const currentIndustry = opp.industry_data || {};
      
      await apiRequest(`/opportunities/${opp.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          industry_data: {
            ...currentIndustry,
            whatsapp_sent_count: currentCount + 1
          }
        }),
      });

      await loadOpportunities();
      setWhatsappOppId(null);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 4000);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCustomerId.trim() || !newProjectName.trim()) return;
    setCreating(true);
    try {
      const activeStage = newStage || (stages[0]?.label ?? "Inquiry");
      
      await apiRequest("/opportunities", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          customer_id: newCustomerId,
          stage: activeStage,
          estimated_value: parseFloat(newValue) || 0,
          currency: "BDT",
          industry_data: {
            project_name: newProjectName.trim(),
            whatsapp_sent_count: 0
          }
        }),
      });

      setShowNewDeal(false);
      setNewTitle(""); setNewCustomerId(""); setNewValue(""); setNewProjectName("");
      await loadOpportunities();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const filteredOppsForProject = selectedProject
    ? (opportunitiesByProject[selectedProject] || []).filter(opp => {
        const q = search.trim().toLowerCase();
        const matchesQuery = !q || opp.title.toLowerCase().includes(q) || opp.customer_id.toLowerCase().includes(q);
        if (!matchesQuery) return false;

        if (activeTab === "all") return true;
        const mappedKey = opp.stage.toLowerCase().replace(/\s+/g, "_");
        return mappedKey === activeTab || opp.stage === activeTab;
      })
    : [];

  const activeOppForWhatsApp = opportunities.find(o => o.id === whatsappOppId) || null;

  return (
    <div className="w-full">
      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-emerald-600 text-white rounded-2xl shadow-glow flex items-center gap-3 animate-fade-down max-w-sm">
          <CheckCircle2 size={18} className="shrink-0 animate-bounce" />
          <div className="text-xs font-bold font-outfit">WhatsApp update dispatched and logged successfully!</div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">
            <TrendingUp size={14} /> Real Estate Workspace
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white font-outfit">
            {selectedProject ? `${selectedProject} Pipeline` : "Project Portal"}
          </h1>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto flex-wrap sm:flex-nowrap">
          {selectedProject && (
            <button
              onClick={() => setSelectedProject(null)}
              className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 hover:bg-white/80 dark:bg-slate-900/40 text-xs font-semibold text-slate-700 dark:text-slate-200 transition active:scale-95"
            >
              Back to Projects
            </button>
          )}
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/50 bg-white/50 px-3 dark:border-white/10 dark:bg-black/20 sm:min-w-[200px]">
            <Search size={15} className="text-slate-500" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
              placeholder="Search leads..."
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
            onClick={() => {
              if (stages.length > 0) setNewStage(stages[0].label);
              setShowNewDeal(true);
            }}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-4 text-sm font-semibold text-white shadow-glow-sm transition hover:from-brand-400 hover:to-indigo-500 active:scale-95"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Plot Deal</span>
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
          <span className="ml-3 text-sm text-slate-500">Loading project data…</span>
        </div>
      ) : projects.length === 0 ? (
        /* Empty State with Action Button */
        <div className="glass-card flex flex-col items-center justify-center gap-4 py-20 text-center rounded-3xl border border-white/20 dark:border-slate-800 bg-white/20 dark:bg-slate-900/10 max-w-lg mx-auto">
          <Home size={48} className="text-brand-400 dark:text-brand-600 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white font-outfit">No Real Estate Projects Found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            Start by creating a new deal and assigning it to a construction project like "Gulshan Apartment" or "Uttara Plot".
          </p>
          <button
            onClick={() => {
              if (stages.length > 0) setNewStage(stages[0].label);
              setShowNewDeal(true);
            }}
            className="mt-2 flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-5 text-sm font-semibold text-white shadow-glow"
          >
            <Plus size={16} /> Create Your First Deal
          </button>
        </div>
      ) : !selectedProject ? (
        /* Project Dashboard Layout */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-up">
          {projects.map(proj => (
            <button
              key={proj.name}
              onClick={() => {
                setSelectedProject(proj.name);
                setActiveTab("all");
              }}
              className="glass-card text-left p-6 rounded-3xl border border-white/30 dark:border-slate-800/80 bg-white/20 hover:bg-white/40 dark:bg-slate-900/10 dark:hover:bg-slate-900/20 shadow-md transition-all active:scale-98 group flex flex-col justify-between min-h-[160px]"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <Building size={22} className="group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-slate-900/5 dark:bg-white/5 text-slate-500">
                  {proj.opportunities.length} active deals
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit truncate">{proj.name}</h3>
                <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Pipeline Value</span>
                  <span className="text-base font-black text-brand-600 dark:text-brand-400">{formatCurrency(proj.totalValue)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Drill-down project details list */
        <div className="flex flex-col gap-6 animate-fade-in w-full min-w-0">
          {/* Horizontal Category Tabs */}
          <div className="overflow-x-auto pb-2 hide-scrollbar">
            <div className="flex items-center min-w-[500px] border-b border-slate-200/60 dark:border-slate-800/60 pb-1 gap-2">
              {realEstateTabs.map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 text-xs font-bold transition rounded-full ${
                      isActive
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opportunity List */}
          <div className="space-y-4">
            {filteredOppsForProject.map(opp => (
              <div
                key={opp.id}
                className="glass-card border border-white/20 dark:border-slate-800/80 rounded-3xl bg-white/40 dark:bg-slate-900/10 p-5 flex items-center justify-between gap-5 shadow-sm hover:shadow-md hover:bg-white/60 dark:hover:bg-slate-900/20 hover:-translate-y-0.5 transition-all relative overflow-hidden"
              >
                {/* Left stage-colored vertical accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand-500 to-indigo-600" />
                
                <div className="min-w-0 flex-1 pl-2">
                  <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                    <select
                      value={opp.stage}
                      onChange={async (e) => {
                        const newStageValue = e.target.value;
                        const targetStage = stages.find(s => s.key === newStageValue || s.label === newStageValue);
                        const dbStageName = targetStage ? targetStage.label : newStageValue;
                        try {
                          await apiRequest(`/opportunities/${opp.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ stage: dbStageName }),
                          });
                          await loadOpportunities();

                          // Automatically trigger the relevant WhatsApp template dispatcher modal
                          const stageKey = newStageValue.toLowerCase().replace(/\s+/g, "_");
                          let autoTemplateId: string | null = null;
                          if (stageKey === "site_visits_booked") autoTemplateId = "visit";
                          else if (stageKey === "deed_legal_review") autoTemplateId = "legal";
                          else if (stageKey === "financing_installments") autoTemplateId = "payment";
                          else if (stageKey === "registration") autoTemplateId = "register";

                          if (autoTemplateId) {
                            setWhatsappOppId(opp.id);
                            setSelectedTemplateId(autoTemplateId);
                            const projName = opp.industry_data?.project_name || "General Projects";
                            const template = messageTemplates.find(t => t.id === autoTemplateId);
                            if (template) {
                              setWhatsappMsgText(template.text.replace("[ProjectName]", projName));
                            }
                          }
                        } catch (err) {
                          alert((err as Error).message);
                        }
                      }}
                      className="text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 border border-brand-500/10 dark:border-brand-500/20 outline-none cursor-pointer hover:bg-brand-500/20 transition-colors font-outfit"
                    >
                      {stages.map(s => (
                        <option key={s.key} value={s.key} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white capitalize">
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {opp.industry_data?.whatsapp_sent_count ? (
                      <span className="text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/10 dark:border-emerald-500/20 flex items-center gap-1 font-outfit">
                        <MessageSquare size={10} />
                        {opp.industry_data.whatsapp_sent_count} updates
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug font-outfit">{opp.title}</h3>
                  <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] text-slate-500 font-semibold max-w-md">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400">
                        <Landmark size={11} />
                      </div>
                      <span className="truncate opacity-80">ID: {opp.customer_id.substring(0, 12)}...</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400">
                        <Calendar size={11} />
                      </div>
                      <span className="opacity-80">
                        Created {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(opp.created_at))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row items-center gap-4 justify-end shrink-0 pl-4 border-l border-slate-100 dark:border-slate-800/60 min-h-[50px]">
                  <div className="text-right pr-2">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider font-outfit">Plot Price</span>
                    <span className="text-lg font-black text-brand-600 dark:text-brand-400 font-outfit">{formatCurrency(opp.estimated_value)}</span>
                  </div>
                  
                  {/* WhatsApp Quick Action Button */}
                  <button
                    onClick={() => handleOpenWhatsAppModal(opp)}
                    className="h-10 w-10 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-glow-sm hover:scale-105 active:scale-95 transition-all"
                    title="Send WhatsApp Update"
                  >
                    <MessageSquare size={18} />
                  </button>
                </div>
              </div>
            ))}

            {filteredOppsForProject.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-8">No leads match this category filter.</p>
            )}
          </div>
        </div>
      )}

      {/* New Deal Modal */}
      {showNewDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/90 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-fade-up">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">New Plot Deal</h2>
              <button onClick={() => setShowNewDeal(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateDeal} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Deal/Plot Title *</label>
                <input
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Plot 45B Booking"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Project/Apartment Name *</label>
                <input
                  required
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder="e.g. Gulshan Heights"
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
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Estimated Price (BDT)</label>
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
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Initial Stage</label>
                  <select
                    value={newStage}
                    onChange={e => setNewStage(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                  >
                    {stages.map(s => (
                      <option key={s.key} value={s.label}>{s.label}</option>
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

      {/* WhatsApp Template Modal */}
      {whatsappOppId && activeOppForWhatsApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl border border-white/20 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-2xl backdrop-blur-2xl p-5 sm:p-6 relative overflow-hidden max-h-[90vh] flex flex-col my-auto">
            {/* Soft decorative background glow */}
            <div className="absolute -right-24 -top-24 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -left-24 -bottom-24 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

            <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 relative z-10 shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <MessageSquare size={16} />
                </div>
                WhatsApp Dispatcher
              </h2>
              <button
                onClick={() => setWhatsappOppId(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 sm:space-y-5 relative z-10 overflow-y-auto pr-1 shrink min-h-0 flex-1">
              {/* Template Selectors */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Select Message Template</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {messageTemplates.map(template => {
                    const isSelected = selectedTemplateId === template.id;
                    const projName = activeOppForWhatsApp.industry_data?.project_name || "General Projects";
                    const previewText = template.text.replace("[ProjectName]", projName);
                    
                    return (
                      <button
                        key={template.id}
                        onClick={() => handleTemplateChange(template.id, activeOppForWhatsApp)}
                        className={`group relative p-3 text-left rounded-2xl border transition-all flex items-start gap-3 shadow-sm hover:scale-[1.01] active:scale-[0.99] min-w-0 ${
                          isSelected
                            ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-glow-sm"
                            : "bg-white/60 border-slate-200 hover:border-slate-300 text-slate-700 dark:bg-slate-800/40 dark:border-slate-700/60 dark:hover:border-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                          isSelected
                            ? "bg-white/15 text-white dark:bg-slate-900/15 dark:text-slate-800"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}>
                          {getTemplateIcon(template.id)}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 justify-center min-h-[36px]">
                          <span className="font-outfit font-bold text-xs leading-tight block truncate group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
                            {template.title}
                          </span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 leading-normal line-clamp-1">
                            {previewText}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message Editor */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Message Draft</label>
                <textarea
                  value={whatsappMsgText}
                  onChange={e => setWhatsappMsgText(e.target.value)}
                  className="w-full h-24 sm:h-28 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-black/30 p-3.5 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20 resize-none leading-relaxed text-slate-800 dark:text-slate-200 shadow-inner"
                />
              </div>

              {/* Send trigger */}
              <button
                onClick={handleSendWhatsApp}
                disabled={sendingMsg || !whatsappMsgText.trim()}
                className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-glow transition active:scale-[0.97] disabled:opacity-40 shrink-0"
              >
                {sendingMsg ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Send Template Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
