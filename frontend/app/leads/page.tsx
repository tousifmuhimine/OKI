"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Columns3,
  Filter,
  LayoutList,
  Mail,
  Phone,
  Plus,
  MessageCircle,
  MessageSquare,
  Globe,
  Sparkles,
  RefreshCw,
  Search,
  User,
  Zap,
  X,
  FileText,
  Loader2,
  BanknoteIcon,
  ChevronDown,
} from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { Customer, Lead, LeadListResponse } from "@/types/crm";

type LeadAnalyticsSummary = {
  total: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  converted: number;
  conversion_rate: number;
};

type ViewMode = "board" | "list";

const statuses = [
  { key: "new", label: "New", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  { key: "contacted", label: "Contacted", tone: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  { key: "qualified", label: "Qualified", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { key: "proposal", label: "Proposal", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { key: "won", label: "Won", tone: "bg-lime-500/15 text-lime-700 dark:text-lime-300" },
  { key: "lost", label: "Lost", tone: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
];

function statusTone(status: string) {
  return statuses.find((item) => item.key === status)?.tone ?? statuses[0].tone;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function SourceIcon({ source, className = "h-4 w-4" }: { source: string | null; className?: string }) {
  if (!source) return <Sparkles className={className} />;
  const s = source.toLowerCase();
  if (s.includes("whatsapp")) return <MessageCircle className={className} />;
  if (s.includes("facebook") || s.includes("messenger")) return <MessageSquare className={className} />;
  if (s.includes("email") || s.includes("mail")) return <Mail className={className} />;
  if (s.includes("website") || s.includes("web")) return <Globe className={className} />;
  return <Sparkles className={className} />;
}

function compactSignal(value: string | null | undefined, fallback: string) {
  if (!value || !String(value).trim()) return fallback;
  return String(value).replace(/_/g, " ");
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [analytics, setAnalytics] = useState<LeadAnalyticsSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [industry, setIndustry] = useState("");
  const [source, setSource] = useState("manual");
  const [rawNotes, setRawNotes] = useState("");
  const [convertingNotes, setConvertingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  // Industry-specific data extracted by AI or entered manually
  const [industryData, setIndustryData] = useState<Record<string, unknown> | null>(null);

  // Budget modal state (shown before conversion)
  const [budgetModalLeadId, setBudgetModalLeadId] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState("");

  // Invoice modal state (shown after conversion)
  type InvoiceData = {
    id: string; customer_id: string; status: string;
    payment_status: string; total_amount: number; currency: string;
    remark: string | null; created_at: string;
  };
  type ConvertResult = { customer: Customer; invoice: InvoiceData | null; opportunity_id: string | null };
  const [invoiceModal, setInvoiceModal] = useState<ConvertResult | null>(null);

  // --- CUSTOM THEMED SELECT COMPONENT ---
  const ThemedSelect = ({
    value,
    onChange,
    options,
    placeholder,
    icon: Icon,
    className = ""
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
    icon: any;
    className?: string;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="h-11 w-full flex items-center gap-3 rounded-xl border border-white/40 bg-white/50 px-3.5 py-2 text-left text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-200"
        >
          {Icon && <Icon size={15} className="text-slate-500 shrink-0" />}
          <span className={`flex-1 truncate font-semibold ${!value ? 'text-slate-400' : ''}`}>{selectedLabel}</span>
          <ChevronDown size={14} className={`text-brand-500/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div className="absolute left-0 right-0 top-full z-[60] mt-2 animate-scale-in overflow-hidden rounded-xl border border-white/20 bg-white/95 p-1 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/95">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-xs font-bold transition-all hover:bg-brand-500 hover:text-white ${
                    value === opt.value
                      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="fixed inset-0 z-50 cursor-default" onClick={() => setIsOpen(false)} />
          </>
        )}
      </div>
    );
  };
  // --- END CUSTOM THEMED SELECT ---

  const selectedLead = leads.find((lead) => lead.id === selectedId) ?? leads[0] ?? null;

  async function loadLeads() {
    try {
      const leadResponse = await apiRequest<LeadListResponse>("/leads?limit=100&offset=0");
      let summaryResponse: LeadAnalyticsSummary | null = null;
      try {
        summaryResponse = await apiRequest<LeadAnalyticsSummary>("/leads/analytics/summary");
      } catch {
        summaryResponse = null;
      }
      setLeads(leadResponse.data);
      setAnalytics(summaryResponse);
      setSelectedId((current) => current && leadResponse.data.some((lead) => lead.id === current)
        ? current
        : leadResponse.data[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { void loadLeads(); }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    function syncView(event: MediaQueryList | MediaQueryListEvent) {
      setViewMode((current) => {
        if ("matches" in event && event.matches && current === "list") {
          return "board";
        }
        if ("matches" in event && !event.matches && current === "board") {
          return "list";
        }
        return current;
      });
    }

    syncView(media);
    media.addEventListener("change", syncView);
    return () => media.removeEventListener("change", syncView);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    function syncDetail(event: MediaQueryList | MediaQueryListEvent) {
      if ("matches" in event && event.matches) {
        setMobileDetailOpen(false);
      }
    }

    syncDetail(media);
    media.addEventListener("change", syncDetail);
    return () => media.removeEventListener("change", syncDetail);
  }, []);

  useEffect(() => {
    if (!mobileDetailOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileDetailOpen]);

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const statusMatches = statusFilter === "all" || (lead.status || "").toLowerCase() === statusFilter.toLowerCase();
      const queryMatches = !needle || [lead.company_name, lead.contact_person, lead.source, lead.assigned_user_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
      return statusMatches && queryMatches;
    });
  }, [leads, query, statusFilter]);

  const groupedLeads = useMemo(() => {
    return statuses.map((statusItem) => ({
      ...statusItem,
      leads: filteredLeads.filter((lead) => lead.status === statusItem.key),
    }));
  }, [filteredLeads]);

  const topSources = useMemo(() => {
    return Object.entries(analytics?.by_source ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [analytics]);

  function handleDragStart(e: React.DragEvent, leadId: string) {
    e.dataTransfer.setData("text/plain", leadId);
    setDraggedLeadId(leadId);
  }

  function handleDragEnd() {
    setDraggedLeadId(null);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent, statusKey: string) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId) {
      const lead = leads.find(l => l.id === leadId);
      if (lead && lead.status !== statusKey) {
        void updateLead(leadId, { status: statusKey });
      }
    }
    setDraggedLeadId(null);
  }

  async function convertNotesWithAI() {
    if (!rawNotes.trim()) {
      setError("Please enter some notes to convert");
      return;
    }

    setConvertingNotes(true);
    setError(null);
    try {
      const result = await apiRequest<Lead & { industry_data?: Record<string, unknown> }>("/leads/ai-convert", {
        method: "POST",
        body: JSON.stringify({ raw_notes: rawNotes }),
      });

      // Populate form with AI-extracted data
      setCompanyName(result.company_name || "");
      setContactPerson(result.contact_person || "");
      setPhone(result.phone || "");
      setEmail(result.email || "");
      setAddress(result.address || "");
      setIndustry(result.industry || "");
      setSource(result.source || "manual");
      // Store industry-specific data
      setIndustryData(result.industry_data ?? null);
      setRawNotes(""); // Clear notes after successful conversion
    } catch (err) {
      setError((err as Error).message || "Failed to convert notes with AI");
    } finally {
      setConvertingNotes(false);
    }
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const lead = await apiRequest<Lead>("/leads", {
        method: "POST",
        body: JSON.stringify({
          company_name: companyName,
          contact_person: contactPerson || null,
          phone: phone || null,
          email: email || null,
          address: address || null,
          industry: industry || null,
          source: source || null,
          status: "new",
          industry_data: industryData || null,
          raw_note: rawNotes || null, // Capture manual notes if any
        }),
      });
      setCompanyName("");
      setContactPerson("");
      setPhone("");
      setEmail("");
      setAddress("");
      setIndustry("");
      setSource("manual");
      setIndustryData(null);
      setRawNotes("");
      setSelectedId(lead.id);
      await loadLeads();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const updateIndustryField = (key: string, value: any) => {
    setIndustryData((prev) => ({
      ...(prev || {}),
      [key]: value,
    }));
  };

  async function updateLead(leadId: string, payload: Partial<Lead>) {
    setSavingId(leadId);
    try {
      const updated = await apiRequest<Lead>(`/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setLeads((current) => current.map((lead) => lead.id === updated.id ? updated : lead));
      await loadLeads();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  async function convertLead(leadId: string, budget?: number) {
    setSavingId(leadId);
    setBudgetModalLeadId(null);
    try {
      const result = await apiRequest<ConvertResult>(`/leads/${leadId}/convert`, {
        method: "POST",
        body: JSON.stringify({ budget: budget ?? 0 }),
      });
      await loadLeads();
      setError(null);
      setInvoiceModal(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  function openLead(leadId: string) {
    setSelectedId(leadId);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setMobileDetailOpen(true);
    }
  }

  function renderLeadDetail(overlay = false) {
    if (!selectedLead) {
      return (
        <div className="grid min-h-72 place-items-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Add or select a lead to manage qualification.
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {overlay ? (
              <button
                type="button"
                onClick={() => setMobileDetailOpen(false)}
                className="mb-3 flex h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-600 transition hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/10 lg:hidden"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">Lead detail</p>
            <h2 className="mt-1 truncate text-xl font-bold text-slate-900 dark:text-white">{selectedLead.company_name}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedLead.contact_person ?? "No contact person"}</p>
          </div>
          <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ${statusTone(selectedLead.status)}`}>
            {selectedLead.status}
          </span>
        </div>

        <dl className="mt-5 grid gap-3 text-sm">
          <div className="rounded-xl bg-white/35 p-3 dark:bg-white/5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source</dt>
            <dd className="mt-1 text-slate-900 dark:text-white">{selectedLead.source ?? "Unsourced"}</dd>
          </div>
          <div className="rounded-xl bg-white/35 p-3 dark:bg-white/5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Industry</dt>
            <dd className="mt-1 capitalize text-slate-900 dark:text-white">{selectedLead.industry?.replace(/_/g, " ") ?? "—"}</dd>
          </div>
          {selectedLead.email && (
            <div className="rounded-xl bg-white/35 p-3 dark:bg-white/5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-1 truncate text-slate-900 dark:text-white">{selectedLead.email}</dd>
            </div>
          )}
          {selectedLead.phone && (
            <div className="rounded-xl bg-white/35 p-3 dark:bg-white/5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</dt>
              <dd className="mt-1 text-slate-900 dark:text-white">{selectedLead.phone}</dd>
            </div>
          )}
          <div className="rounded-xl bg-white/35 p-3 dark:bg-white/5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</dt>
            <dd className="mt-1 truncate text-slate-900 dark:text-white">{selectedLead.assigned_user_id ?? "Unassigned"}</dd>
          </div>
          <div className="rounded-xl bg-white/35 p-3 dark:bg-white/5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</dt>
            <dd className="mt-1 text-slate-900 dark:text-white">{formatDate(selectedLead.created_at)}</dd>
          </div>
        </dl>

        <div className="mt-4 rounded-xl border border-brand-200/40 bg-brand-50/60 p-3 dark:border-brand-500/20 dark:bg-brand-500/10">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
            <Sparkles size={12} />
            Lead signals
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-lg bg-white/80 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
              Intent: {compactSignal(selectedLead.intent, "Unknown")}
            </span>
            <span className="rounded-lg bg-white/80 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
              Engagement: {compactSignal(selectedLead.engagement, "Unknown")}
            </span>
            <span className="rounded-lg bg-white/80 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
              Trust: {compactSignal(selectedLead.trust_level, "Unknown")}
            </span>
            {selectedLead.last_summary ? (
              <span className="rounded-lg bg-white/80 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                Summary: {selectedLead.last_summary}
              </span>
            ) : null}
          </div>
        </div>

        {/* Industry-specific data panel */}
        {selectedLead.industry_data && Object.keys(selectedLead.industry_data).length > 0 && (
          <div className="mt-4 rounded-xl border border-brand-200/40 bg-brand-50/60 p-3 dark:border-brand-500/20 dark:bg-brand-500/10">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
              <Sparkles size={12} />
              Industry Profile
            </p>
            <dl className="grid gap-2">
              {Object.entries(selectedLead.industry_data).map(([key, value]) =>
                value !== null && value !== undefined && String(value).trim() !== "" ? (
                  <div key={key} className="flex items-start justify-between gap-2 text-xs">
                    <dt className="capitalize text-slate-500 dark:text-slate-400">{key.replace(/_/g, " ")}</dt>
                    <dd className="font-semibold text-right text-slate-800 dark:text-slate-100">{String(value)}</dd>
                  </div>
                ) : null
              )}
            </dl>
          </div>
        )}

        {/* Raw note audit trail */}
        {selectedLead.raw_note && (
          <details className="mt-3 rounded-xl border border-dashed border-slate-200/60 dark:border-white/10">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              <FileText size={11} className="mr-1 inline" /> Raw Agent Note
            </summary>
            <p className="px-3 pb-3 pt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{selectedLead.raw_note}</p>
          </details>
        )}

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Move status</p>
          <div className="grid grid-cols-2 gap-2">
            {statuses.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => void updateLead(selectedLead.id, { status: item.key })}
                disabled={savingId === selectedLead.id || selectedLead.status === item.key}
                className={`h-11 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50 sm:h-10 ${item.tone}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            disabled={savingId === selectedLead.id || Boolean(selectedLead.converted_customer_id)}
            onClick={() => {
              if (selectedLead.converted_customer_id) return;
              setBudgetInput("");
              setBudgetModalLeadId(selectedLead.id);
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-semibold text-white transition hover:bg-emerald-600 active:scale-95 disabled:opacity-60"
          >
            {savingId === selectedLead.id ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {selectedLead.converted_customer_id ? "Converted ✓" : "Convert to Customer"}
          </button>
          <button
            type="button"
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/45 text-sm font-semibold text-slate-700 transition hover:bg-white/70 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
            title="The current lead table has no dedicated email field yet."
          >
            <Mail size={16} />
            Email follow-up
          </button>
        </div>


      </div>
    );
  }

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] overflow-x-clip bg-transparent px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
        <div className="mx-auto w-full max-w-screen-2xl min-w-0">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">Lead Management</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Lead Operations</h1>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "board" ? "list" : "board")}
              className="glass-panel flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-700 transition hover:bg-white/60 dark:text-slate-200 dark:hover:bg-white/10 sm:h-10 sm:flex-none"
            >
              {viewMode === "board" ? <LayoutList size={16} /> : <Columns3 size={16} />}
              {viewMode === "board" ? "List" : "Board"}
            </button>
            <button
              type="button"
              onClick={() => void loadLeads()}
              className="glass-panel flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-700 transition hover:bg-white/60 dark:text-slate-200 dark:hover:bg-white/10 sm:h-10 sm:flex-none"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 backdrop-blur-md dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        <div className="mb-5 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 xl:grid-cols-4">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total leads</span>
              <Zap size={17} className="text-brand-500" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {analytics
                ? analytics.total - (analytics.by_status?.lost || 0) - (analytics.by_status?.won || 0)
                : leads.filter((l) => l.status !== "lost" && l.status !== "won").length}
            </p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Converted</span>
              <CheckCircle2 size={17} className="text-emerald-500" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">{analytics?.converted ?? 0}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Conversion rate</span>
              <CircleDollarSign size={17} className="text-amber-500" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">{analytics?.conversion_rate ?? 0}%</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Top source</span>
              <BarChart3 size={17} className="text-cyan-500" />
            </div>
            <p className="mt-3 truncate text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">{topSources[0]?.[0] ?? "None"}</p>
          </div>
        </div>

        <div className="mb-5 glass-card p-4">
          <label className="mb-3 block">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={15} className="text-brand-500" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Magic Convert (AI)</span>
              <span className="text-xs text-slate-500">Paste raw notes and we'll extract the lead info</span>
            </div>
            <textarea
              value={rawNotes}
              onChange={(event) => setRawNotes(event.target.value)}
              placeholder="Paste agent notes, call transcripts, or chat messages here..."
              className="h-24 w-full rounded-xl border border-white/50 bg-white/55 p-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </label>
          <button
            type="button"
            onClick={convertNotesWithAI}
            disabled={convertingNotes || !rawNotes.trim()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-purple-500 px-4 text-sm font-semibold text-white shadow-glow-sm transition hover:bg-purple-600 active:scale-95 disabled:opacity-60"
          >
            <Sparkles size={16} />
            {convertingNotes ? "Converting..." : "Magic Convert"}
          </button>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          {industryData && Object.keys(industryData).length > 0 && (
            <div className="mt-3 rounded-xl border border-purple-200/50 bg-purple-50/60 p-3 dark:border-purple-500/20 dark:bg-purple-500/10">
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400">
                <Sparkles size={10} /> AI Extracted — Industry Data
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(industryData).map(([key, value]) =>
                  value !== null && value !== undefined && String(value).trim() !== "" ? (
                    <span key={key} className="rounded-lg bg-purple-100/80 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                      {key.replace(/_/g, " ")}: {String(value)}
                    </span>
                  ) : null
                )}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={createLead} className="mb-8 glass-card overflow-hidden">
          {/* Form Header */}
          <div className="border-b border-white/10 bg-white/20 px-6 py-4 dark:bg-white/5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Create New Lead</h3>
          </div>

          <div className="p-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Identity Section */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">Identity</p>
                <div className="space-y-3">
                  <label className="relative block">
                    <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      required
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      className="h-11 w-full rounded-xl border border-white/40 bg-white/50 py-2 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/30 dark:text-white"
                      placeholder="Company Name"
                    />
                  </label>
                  <label className="relative block">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={contactPerson}
                      onChange={(event) => setContactPerson(event.target.value)}
                      className="h-11 w-full rounded-xl border border-white/40 bg-white/50 py-2 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/30 dark:text-white"
                      placeholder="Contact Person"
                    />
                  </label>
                </div>
              </div>

              {/* Contact Section */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">Contact Info</p>
                <div className="space-y-3">
                  <label className="relative block">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="h-11 w-full rounded-xl border border-white/40 bg-white/50 py-2 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/30 dark:text-white"
                      placeholder="Phone Number"
                    />
                  </label>
                  <label className="relative block">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11 w-full rounded-xl border border-white/40 bg-white/50 py-2 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/30 dark:text-white"
                      placeholder="Email Address"
                    />
                  </label>
                </div>
              </div>

              {/* Classification Section */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">Classification</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <ThemedSelect
                      value={industry}
                      onChange={setIndustry}
                      icon={Building2}
                      placeholder="Select Industry"
                      options={[
                        { value: "real_estate", label: "Real Estate" },
                        { value: "ecommerce", label: "E-com" },
                        { value: "agro", label: "Agro" },
                        { value: "manufacture", label: "Manufacture" },
                        { value: "study_abroad", label: "Study Abroad" },
                      ]}
                    />
                    <ThemedSelect
                      value={source}
                      onChange={setSource}
                      icon={Globe}
                      placeholder="Source"
                      options={[
                        { value: "manual", label: "Manual" },
                        { value: "website", label: "Website" },
                        { value: "outbound", label: "Outbound" },
                        { value: "referral", label: "Referral" },
                      ]}
                    />
                  </div>
                  <label className="relative block">
                    <FileText size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      className="h-11 w-full rounded-xl border border-white/40 bg-white/50 py-2 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/30 dark:text-white"
                      placeholder="Address / Location"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Dynamic Industry Context Section */}
            {industry && ["real_estate", "study_abroad", "ecommerce"].includes(industry) && (
              <div className="mt-8 animate-fade-up">
                <div className="rounded-2xl border border-brand-200/50 bg-brand-50/30 p-5 dark:border-brand-500/20 dark:bg-brand-500/5">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500 text-white">
                      <Sparkles size={12} />
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
                      Contextual Details: {industry.replace(/_/g, " ")}
                    </h4>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {industry === "real_estate" && (
                      <>
                        <label className="relative">
                          <BanknoteIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500/70" />
                          <input
                            type="number"
                            value={(industryData?.budget as string) || ""}
                            onChange={(e) => updateIndustryField("budget", e.target.value)}
                            className="h-10 w-full rounded-lg border border-brand-200/50 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 dark:border-brand-500/20 dark:bg-black/40 dark:text-white"
                            placeholder="Budget (BDT)"
                          />
                        </label>
                        <label className="relative">
                          <Columns3 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500/70" />
                          <input
                            type="number"
                            value={(industryData?.square_feet as string) || ""}
                            onChange={(e) => updateIndustryField("square_feet", e.target.value)}
                            className="h-10 w-full rounded-lg border border-brand-200/50 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 dark:border-brand-500/20 dark:bg-black/40 dark:text-white"
                            placeholder="Sq. Feet"
                          />
                        </label>
                      </>
                    )}

                    {industry === "study_abroad" && (
                      <>
                        <ThemedSelect
                          value={(industryData?.preferred_country as string) || ""}
                          onChange={(v) => updateIndustryField("preferred_country", v)}
                          icon={Globe}
                          placeholder="Country"
                          className="h-10"
                          options={[
                            { value: "UK", label: "UK" },
                            { value: "US", label: "US" },
                            { value: "AUS", label: "AUS" },
                            { value: "CA", label: "CA" },
                          ]}
                        />
                        <label className="relative">
                          <CircleDollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500/70" />
                          <input
                            value={(industryData?.financial_status as string) || ""}
                            onChange={(e) => updateIndustryField("financial_status", e.target.value)}
                            className="h-10 w-full rounded-lg border border-brand-200/50 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 dark:border-brand-500/20 dark:bg-black/40 dark:text-white"
                            placeholder="Financial Status"
                          />
                        </label>
                      </>
                    )}

                    {industry === "ecommerce" && (
                      <>
                        <label className="relative">
                          <Zap size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500/70" />
                          <input
                            value={(industryData?.product_interest as string) || ""}
                            onChange={(e) => updateIndustryField("product_interest", e.target.value)}
                            className="h-10 w-full rounded-lg border border-brand-200/50 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 dark:border-brand-500/20 dark:bg-black/40 dark:text-white"
                            placeholder="Product"
                          />
                        </label>
                        <label className="relative">
                          <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500/70" />
                          <input
                            value={(industryData?.delivery_location as string) || ""}
                            onChange={(e) => updateIndustryField("delivery_location", e.target.value)}
                            className="h-10 w-full rounded-lg border border-brand-200/50 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 dark:border-brand-500/20 dark:bg-black/40 dark:text-white"
                            placeholder="Location"
                          />
                        </label>
                        <ThemedSelect
                          value={(industryData?.urgency_level as string) || ""}
                          onChange={(v) => updateIndustryField("urgency_level", v)}
                          icon={Filter}
                          placeholder="Urgency"
                          className="h-10"
                          options={[
                            { value: "Low", label: "Low" },
                            { value: "Medium", label: "Medium" },
                            { value: "High", label: "High" },
                          ]}
                        />
                        <ThemedSelect
                          value={(industryData?.preferred_platform as string) || ""}
                          onChange={(v) => updateIndustryField("preferred_platform", v)}
                          icon={MessageSquare}
                          placeholder="Platform"
                          className="h-10"
                          options={[
                            { value: "Messenger", label: "Messenger" },
                            { value: "WhatsApp", label: "WhatsApp" },
                          ]}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-end border-t border-white/10 pt-6">
              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-8 text-sm font-bold text-white shadow-glow transition hover:from-brand-600 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-60 sm:w-auto"
              >
                <Plus size={18} />
                {loading ? "Creating Lead..." : "Create New Lead"}
              </button>
            </div>
          </div>
        </form>

        <div className="mb-5 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-3">
            <div className="glass-card flex flex-wrap items-center gap-3 p-3">
              <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/50 bg-white/50 px-3 dark:border-white/10 dark:bg-black/20 sm:h-10 sm:min-w-[220px]">
                <Search size={15} className="text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                  placeholder="Search leads"
                  type="search"
                />
              </div>
              <div className={`flex w-full max-w-full items-center gap-2 overflow-x-auto sm:w-auto ${viewMode === 'board' ? 'hidden' : ''}`}>
                <Filter size={15} className="shrink-0 text-slate-500" />
                {["all", ...statuses.map((item) => item.key)].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStatusFilter(item)}
                    className={`h-10 shrink-0 rounded-lg px-3 text-xs font-semibold capitalize transition sm:h-9 ${
                      statusFilter === item
                        ? "bg-brand-500 text-white"
                        : "bg-white/35 text-slate-600 hover:bg-white/60 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {viewMode === "board" ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                {groupedLeads.map((column) => (
                  <section 
                    key={column.key} 
                    className="glass-card min-h-64 p-3"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, column.key)}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${column.tone}`}>{column.label}</span>
                      <span className="text-xs font-semibold text-slate-500">{column.leads.length}</span>
                    </div>
                    <div className="space-y-2">
                      {column.leads.map((lead) => (
                        <button
                          key={lead.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, lead.id)}
                          onDragEnd={handleDragEnd}
                          type="button"
                          onClick={() => openLead(lead.id)}
                          className={`w-full rounded-xl p-3 text-left transition hover:bg-white/45 dark:hover:bg-white/10 cursor-grab active:cursor-grabbing ${
                            selectedLead?.id === lead.id ? "bg-brand-500/15 ring-1 ring-brand-300/40" : "bg-white/25 dark:bg-white/5"
                          } ${draggedLeadId === lead.id ? "opacity-50" : "opacity-100"}`}
                        >
                          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{lead.company_name}</span>
                          <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{lead.contact_person ?? "No contact"}</span>
                          <span className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            <span className="rounded-full bg-white/60 px-2 py-0.5 dark:bg-white/10">{compactSignal(lead.intent, "Intent: unknown")}</span>
                            <span className="rounded-full bg-white/60 px-2 py-0.5 dark:bg-white/10">{compactSignal(lead.engagement, "Engagement: unknown")}</span>
                            <span className="rounded-full bg-white/60 px-2 py-0.5 dark:bg-white/10">{compactSignal(lead.trust_level, "Trust: unknown")}</span>
                          </span>
                          <span className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1.5 truncate">
                              <SourceIcon source={lead.source} className="h-3.5 w-3.5 shrink-0" />
                              <span className="capitalize">{lead.source ?? "unsourced"}</span>
                              {lead.capture_source === "auto" && (
                                <span className="rounded bg-brand-100 px-1 py-0.5 text-[9px] font-bold text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                                  AUTO
                                </span>
                              )}
                            </span>
                            <span>{formatDate(lead.updated_at)}</span>
                          </span>
                        </button>
                      ))}
                      {column.leads.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-white/30 px-3 py-8 text-center text-xs text-slate-500 dark:border-white/10">
                          No leads
                        </p>
                      ) : null}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredLeads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => openLead(lead.id)}
                      className={`glass-card w-full p-4 text-left transition active:scale-[0.99] ${
                        selectedLead?.id === lead.id ? "ring-1 ring-brand-300/50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{lead.company_name}</p>
                          <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{lead.contact_person ?? "No contact"}</p>
                          <p className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            <span className="rounded-full bg-white/60 px-2 py-0.5 dark:bg-white/10">{compactSignal(lead.intent, "Intent: unknown")}</span>
                            <span className="rounded-full bg-white/60 px-2 py-0.5 dark:bg-white/10">{compactSignal(lead.engagement, "Engagement: unknown")}</span>
                            <span className="rounded-full bg-white/60 px-2 py-0.5 dark:bg-white/10">{compactSignal(lead.trust_level, "Trust: unknown")}</span>
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusTone(lead.status)}`}>
                          {lead.status}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5 truncate">
                          <SourceIcon source={lead.source} className="h-4 w-4 shrink-0" />
                          <span className="capitalize">{lead.source ?? "unsourced"}</span>
                          {lead.capture_source === "auto" && (
                            <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                              AUTO
                            </span>
                          )}
                        </span>
                        <span>{formatDate(lead.updated_at)}</span>
                      </div>
                    </button>
                  ))}
                  {filteredLeads.length === 0 ? (
                    <div className="glass-card px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                      No leads match this filter yet.
                    </div>
                  ) : null}
                </div>

                <div className="hidden overflow-hidden glass-card md:block">
                  <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-white/20 bg-white/20 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                      <th className="px-5 py-3.5">Company</th>
                      <th className="px-5 py-3.5">Contact</th>
                      <th className="px-5 py-3.5">Source</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/20 dark:divide-white/10">
                    {filteredLeads.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => openLead(lead.id)}
                        className="cursor-pointer transition hover:bg-white/40 dark:hover:bg-white/10"
                      >
                        <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100">{lead.company_name}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{lead.contact_person ?? "-"}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-2">
                            <SourceIcon source={lead.source} className="h-4 w-4 text-slate-400" />
                            <span className="capitalize">{lead.source ?? "-"}</span>
                            {lead.capture_source === "auto" && (
                              <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                                AUTO
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusTone(lead.status)}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(lead.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>

          <aside className="hidden glass-card h-fit p-4 lg:sticky lg:top-[70px] lg:block">
            {renderLeadDetail()}
          </aside>
        </div>
        {mobileDetailOpen && selectedLead ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close lead detail"
              onClick={() => setMobileDetailOpen(false)}
              className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Lead detail"
              className="absolute inset-x-0 bottom-0 top-[72px] overflow-y-auto overscroll-contain rounded-t-[28px] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-20px_50px_rgba(15,23,42,0.22)] dark:bg-slate-950"
            >
              {renderLeadDetail(true)}
            </aside>
          </div>
        ) : null}
        </div>
      </section>

      {budgetModalLeadId && (() => {
        const lead = leads.find(l => l.id === budgetModalLeadId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-fade-up">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Convert to Customer</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{lead?.company_name}</p>
                </div>
                <button onClick={() => setBudgetModalLeadId(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"><X size={16} /></button>
              </div>
              <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-500/20 p-3 mb-4">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  This will create a <strong>Customer</strong>, an <strong>Opportunity</strong> in Discovery stage, and a <strong>draft Invoice</strong> — all linked to this lead.
                </p>
              </div>
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <BanknoteIcon size={12} className="inline mr-1" /> Estimated Deal Budget (BDT)
                </label>
                <input type="number" min="0" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} placeholder="e.g. 500000" autoFocus
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white/80 px-4 text-base font-semibold text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                <p className="mt-1 text-[11px] text-slate-400">Leave 0 if unknown. You can update later in Pipeline.</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setBudgetModalLeadId(null)} className="flex-1 h-11 rounded-xl border border-slate-200 bg-white/60 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">Cancel</button>
                <button type="button" disabled={savingId === budgetModalLeadId} onClick={() => void convertLead(budgetModalLeadId, parseFloat(budgetInput) || 0)}
                  className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-600 active:scale-95 disabled:opacity-60">
                  {savingId === budgetModalLeadId ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Convert Now
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {invoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-fade-up">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20"><CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" /></div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Conversion Successful!</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Customer created and invoice generated</p>
              </div>
            </div>
            <div className="rounded-xl bg-white/60 dark:bg-white/5 border border-white/30 dark:border-white/10 p-4 mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">New Customer</p>
              <p className="font-bold text-slate-900 dark:text-white">{(invoiceModal.customer as unknown as Record<string, string>)?.company_name ?? "—"}</p>
              <p className="text-xs text-slate-500">{(invoiceModal.customer as unknown as Record<string, string>)?.contact_person ?? ""}</p>
            </div>
            {invoiceModal.invoice && (
              <div className="rounded-xl bg-brand-50/60 dark:bg-brand-500/10 border border-brand-200/50 dark:border-brand-500/20 p-4 mb-4">
                <div className="flex items-center gap-2 mb-3"><FileText size={14} className="text-brand-600 dark:text-brand-400" /><p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">Draft Invoice Created</p></div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Invoice ID</span><span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{invoiceModal.invoice.id.slice(0, 12)}…</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-bold text-brand-600 dark:text-brand-400">{invoiceModal.invoice.currency} {invoiceModal.invoice.total_amount.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Payment Status</span><span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">{invoiceModal.invoice.payment_status}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Pipeline Stage</span><span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">Discovery</span></div>
                </div>
              </div>
            )}
            <button type="button" onClick={() => setInvoiceModal(null)} className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-sm font-semibold text-white shadow-glow-sm hover:from-brand-400 hover:to-indigo-500 active:scale-95">
              <CheckCircle2 size={16} /> Done
            </button>
          </div>
        </div>
      )}
    </ProtectedPage>
  );
}
