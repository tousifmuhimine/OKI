"use client";

import { FormEvent, useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Columns3,
  Edit2,
  Eye,
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
  Trash2,
  User,
  Zap,
  X,
  FileText,
  Loader2,
  BanknoteIcon,
  ChevronDown, Briefcase, Edit, Smartphone, Flag, Calendar, Info, MoreVertical
} from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";
import {
  Customer,
  Lead,
  LeadActivity,
  LeadListResponse,
  LeadNamedConfig,
  LeadSourceConfig,
  LeadStageConfig,
  LeadTimelineItem,
} from "@/types/crm";

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

const suggestedTags = ["vip", "hot", "follow-up", "inbound", "upsell"];
const industryOptions = [
  { value: "real_estate", label: "Real Estate" },
  { value: "ecommerce", label: "E-com" },
  { value: "agro", label: "Agro" },
  { value: "manufacture", label: "Manufacture" },
  { value: "study_abroad", label: "Study Abroad" },
];

type LeadConfigs = {
  sources: LeadSourceConfig[];
  stages: LeadStageConfig[];
  sectors: LeadNamedConfig[];
  areas: LeadNamedConfig[];
  professions: LeadNamedConfig[];
};

function statusTone(status: string) {
  return statuses.find((item) => item.key === status)?.tone ?? statuses[0].tone;
}

function stageTone(stageName: string | null | undefined, fallbackStatus?: string) {
  const key = (stageName || fallbackStatus || "new").toLowerCase().replace(/\s+/g, "_");
  if (key.includes("won") || key.includes("closed")) return "bg-lime-500/15 text-lime-700 dark:text-lime-300";
  if (key.includes("lost")) return "bg-slate-500/15 text-slate-600 dark:text-slate-300";
  if (key.includes("proposal")) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  if (key.includes("qualified") || key.includes("interested")) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (key.includes("contact")) return "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300";
  return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function normalizeTagValue(value: string) {
  return value.trim().toLowerCase();
}

function splitTags(raw: string) {
  return raw.split(/[\n,]/).map(normalizeTagValue).filter(Boolean);
}

function mergeTags(existing: string[], incoming: string[]) {
  const seen = new Set(existing.map((tag) => tag.toLowerCase()));
  const merged = [...existing];
  for (const tag of incoming) {
    const normalized = tag.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      merged.push(normalized);
    }
  }
  return merged;
}

function tagLabel(tag: string) {
  return tag.replace(/[_-]/g, " ");
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

function apiDate(value: string, endOfDay = false) {
  if (!value) return "";
  return `${value}T${endOfDay ? "23:59:59" : "00:00:00"}`;
}

function LeadsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string | null; email: string | null }[]>([]);
  const [analytics, setAnalytics] = useState<LeadAnalyticsSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ role: string; id: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [industry, setIndustry] = useState("");
  const [source, setSource] = useState("manual");
  const [leadSourceId, setLeadSourceId] = useState("");
  const [leadStageId, setLeadStageId] = useState("");
  const [leadAreaId, setLeadAreaId] = useState("");
  const [leadProfessionId, setLeadProfessionId] = useState("");
  const [leadPriority, setLeadPriority] = useState("");
  const [leadTags, setLeadTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [rawNotes, setRawNotes] = useState("");
  const [convertingNotes, setConvertingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editPhoneWarning, setEditPhoneWarning] = useState<string | null>(null);

  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  // Industry-specific data extracted by AI or entered manually
  const [industryData, setIndustryData] = useState<Record<string, unknown> | null>(null);
  const [leadSidebarTab, setLeadSidebarTab] = useState<"details" | "activity" | "edit">("details");

  const [lastEducation, setLastEducation] = useState("");
  const [leadAssignedUserIds, setLeadAssignedUserIds] = useState<string[]>([]);
  const [editAssignedUserIds, setEditAssignedUserIds] = useState<string[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchFilter, setBranchFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [leadDocuments, setLeadDocuments] = useState<any[]>([]);
  const [leadDocUploading, setLeadDocUploading] = useState(false);
  const [leadDocError, setLeadDocError] = useState<string | null>(null);

  // Custom states added for tenancy, custom fields & bulk actions
  const [orgTypeCode, setOrgTypeCode] = useState<string | null>(null);
  const [leadAssignedUserId, setLeadAssignedUserId] = useState("");
  const [countryInput, setCountryInput] = useState("");
  const [editCountryInput, setEditCountryInput] = useState("");
  const [editIndustryData, setEditIndustryData] = useState<Record<string, unknown> | null>(null);
  const [customerDocuments, setCustomerDocuments] = useState<any[]>([]);
  
  // Bulk share states
  const [isBulkShareOpen, setIsBulkShareOpen] = useState(false);
  const [bulkShareLinks, setBulkShareLinks] = useState<{ company: string; url: string }[]>([]);
  const [bulkShareEmails, setBulkShareEmails] = useState("");
  const [bulkShareMode, setBulkShareMode] = useState<"public" | "restricted">("restricted");
  const [bulkSharing, setBulkSharing] = useState(false);
  const [bulkShareError, setBulkShareError] = useState<string | null>(null);

  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkStageOpen, setBulkStageOpen] = useState(false);
  const [shareLeadId, setShareLeadId] = useState<string | null>(null);
  const [shareMode, setShareMode] = useState<"public" | "restricted">("restricted");
  const [shareEmails, setShareEmails] = useState("");
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [extraInfoMenuOpen, setExtraInfoMenuOpen] = useState(false);
  const [extraInfoValues, setExtraInfoValues] = useState<Record<string, string>>({});
  const additionalInfoOptions = [
    { key: "website", label: "Website" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "facebook", label: "Facebook" },
    { key: "twitter", label: "Twitter" },
    { key: "instagram", label: "Instagram" },
    { key: "youtube", label: "YouTube" },
    { key: "address", label: "Address" },
  ];
  const [quickFilter, setQuickFilter] = useState("all");
  const [configs, setConfigs] = useState<LeadConfigs>({ sources: [], stages: [], sectors: [], areas: [], professions: [] });
  const [activities, setActivities] = useState<LeadTimelineItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityNote, setActivityNote] = useState("");
  const [activityPlatform, setActivityPlatform] = useState("phone");
  const [followUpDate, setFollowUpDate] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [actionDropdownId, setActionDropdownId] = useState<string | null>(null);
  const [editModalLeadId, setEditModalLeadId] = useState<string | null>(null);

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
    className = "",
    name
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
    icon: any;
    className?: string;
    name?: string;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
      <div className={`relative ${className}`}>
        {name && <input type="hidden" name={name} value={value} />}
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
            <div className="absolute left-0 right-0 top-full z-[80] mt-2 animate-scale-in overflow-hidden rounded-xl border border-white/20 bg-white/95 p-1 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/95">
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
            <div className="fixed inset-0 z-[70] cursor-default" onClick={() => setIsOpen(false)} />
          </>
        )}
      </div>
    );
  };

  const UncontrolledThemedSelect = ({ defaultValue = "", name, options, placeholder, icon, className = "" }: any) => {
    const [val, setVal] = useState(defaultValue);
    return <ThemedSelect value={val} onChange={setVal} name={name} options={options} placeholder={placeholder} icon={icon} className={className} />;
  };
  // --- END CUSTOM THEMED SELECT ---

  const selectedLead = leads.find((lead) => lead.id === selectedId) ?? null;
  const selectedStage = selectedLead?.lead_stage_id ? configs.stages.find((stage) => stage.id === selectedLead.lead_stage_id) : null;
  const selectedSource = selectedLead?.lead_source_id ? configs.sources.find((item) => item.id === selectedLead.lead_source_id) : null;
  const selectedArea = selectedLead?.lead_area_id ? configs.areas.find((item) => item.id === selectedLead.lead_area_id) : null;
  const selectedProfession = selectedLead?.lead_profession_id ? configs.professions.find((item) => item.id === selectedLead.lead_profession_id) : null;
  const dynamicStages: { key: string; label: string; tone: string; id?: string }[] = configs.stages.length
    ? configs.stages.map((stage) => ({
        key: stage.name.toLowerCase().replace(/\s+/g, "_"),
        label: stage.name,
        tone: stageTone(stage.name),
        id: stage.id,
      }))
    : statuses.map((status) => ({ ...status, id: undefined }));

  async function loadLeads() {
    try {
      const params = new URLSearchParams({ limit: "100", offset: "0", sort: sortOrder });
      if (query.trim()) params.set("search", query.trim());
      if (statusFilter !== "all") params.set(configs.stages.some((stage) => stage.id === statusFilter) ? "stage_id" : "status", statusFilter);
      if (sourceFilter !== "all") params.set("source_id", sourceFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (tagFilter !== "all") params.set("tag", tagFilter);
      // Agents always see only their assigned leads
      if (currentUser?.role === "agent") {
        params.set("quick_filter", "assigned_to_me");
      } else if (quickFilter !== "all") {
        params.set("quick_filter", quickFilter === "assigned" ? "assigned_to_me" : quickFilter === "followup" ? "followups_due" : quickFilter);
      }
      if (branchFilter !== "all") params.set("branch_id", branchFilter);
      if (agentFilter !== "all") params.set("assigned_user_id", agentFilter);
      if (startDate) params.set("start_date", apiDate(startDate));
      if (endDate) params.set("end_date", apiDate(endDate, true));
      const leadResponse = await apiRequest<LeadListResponse>(
        currentUser?.role === "agent"
          ? `/ai/assigned-leads?${params.toString()}`
          : `/leads?${params.toString()}`
      );
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
        : null);
      setSelectedLeadIds([]);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    const leadId = searchParams.get("leadId");
    const tab = searchParams.get("tab");
    if (tab === "activity" || tab === "edit" || tab === "details") {
      setLeadSidebarTab(tab);
    }
    if (leadId && leadId !== selectedId) {
      setSelectedId(leadId);
    }
  }, [searchParams, selectedId]);

  // Real-time phone check for Create Modal
  useEffect(() => {
    if (!phone || !phone.trim()) {
      setPhoneWarning(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<{ available: boolean; existing_name: string | null }>(
          `/leads/check-phone?phone=${encodeURIComponent(phone.trim())}`
        );
        if (!res.available) {
          setPhoneWarning(`Lead with this phone number already exists: ${res.existing_name}`);
        } else {
          setPhoneWarning(null);
        }
      } catch (err) {
        setPhoneWarning(null);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [phone]);

  // Sync editPhone, editTags, editIndustryData, and aiInstructions when editModalLeadId changes
  useEffect(() => {
    if (editModalLeadId) {
      const lead = leads.find((l) => l.id === editModalLeadId);
      if (lead) {
        setEditPhone(lead.phone || "");
        setEditTags(lead.tags ?? []);
        setAiInstructions(lead.ai_instructions ?? "");
        setEditAssignedUserIds(lead.assigned_user_ids ?? []);
        setEditIndustryData(lead.industry_data ?? null);
      }
      setEditPhoneWarning(null);
    } else {
      setEditPhone("");
      setEditTags([]);
      setAiInstructions("");
      setEditAssignedUserIds([]);
      setEditIndustryData(null);
      setEditPhoneWarning(null);
    }
  }, [editModalLeadId, leads]);

  // Real-time phone check for Edit Modal
  useEffect(() => {
    if (!editPhone || !editPhone.trim() || !editModalLeadId) {
      setEditPhoneWarning(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<{ available: boolean; existing_name: string | null }>(
          `/leads/check-phone?phone=${encodeURIComponent(editPhone.trim())}&exclude_lead_id=${editModalLeadId}`
        );
        if (!res.available) {
          setEditPhoneWarning(`Lead with this phone number already exists: ${res.existing_name}`);
        } else {
          setEditPhoneWarning(null);
        }
      } catch (err) {
        setEditPhoneWarning(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [editPhone, editModalLeadId]);

  async function loadConfigs() {
    try {
      const [sources, stages, sectors, areas, professions, usersRes, branchesRes] = await Promise.all([
        apiRequest<LeadSourceConfig[]>("/config/lead-sources?active_only=true"),
        apiRequest<LeadStageConfig[]>("/config/lead-stages?active_only=true"),
        apiRequest<LeadNamedConfig[]>("/config/lead-sectors?active_only=true"),
        apiRequest<LeadNamedConfig[]>("/config/lead-areas?active_only=true"),
        apiRequest<LeadNamedConfig[]>("/config/lead-professions?active_only=true"),
        apiRequest<any[]>("/organizations/users").catch(() => []),
        apiRequest<any[]>("/organizations/branches").catch(() => []),
      ]);
      setConfigs({ sources, stages, sectors, areas, professions });
      setUsers(usersRes);
      setBranches(branchesRes);

    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function loadActivities(leadId: string) {
    setActivityLoading(true);
    try {
      const response = await apiRequest<LeadTimelineItem[]>(`/leads/${leadId}/timeline`);
      setActivities(response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActivityLoading(false);
    }
  }

  // Load current user role and org type code
  useEffect(() => {
    if (typeof window !== "undefined") {
      const code = sessionStorage.getItem("oki_org_type_code") || "study_abroad";
      setOrgTypeCode(code);
      setIndustry(code);
    }

    // Fetch organization info to get the dynamic type code
    apiRequest<{ organization_type_code: string | null }>("/organizations/me")
      .then((org) => {
        if (org.organization_type_code) {
          setOrgTypeCode(org.organization_type_code);
          setIndustry(org.organization_type_code);
          if (typeof window !== "undefined") {
            sessionStorage.setItem("oki_org_type_code", org.organization_type_code);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to fetch organization info:", err);
      });

    apiRequest<{ id: string; role_code: string } | { id: string; role: string }>("/organizations/users/me")
      .then((user: any) => {
        const rawRole = user.role_code || user.role || "agent";
        const role = rawRole === "individual_agent" ? "agent" : rawRole;
        setCurrentUser({ role, id: user.id });
      })
      .catch(() => {
        getSupabaseClient().auth.getUser().then(({ data }) => {
          if (data.user) {
            const rawRole = data.user.user_metadata?.role || "agent";
            const role = rawRole === "individual_agent" ? "agent" : rawRole;
            setCurrentUser({ role, id: data.user.id });
          }
        });
      });
  }, []);

  useEffect(() => {
    if (orgTypeCode) {
      setIndustry(orgTypeCode);
    }
  }, [orgTypeCode, createLeadOpen]);

  useEffect(() => {
    if (!currentUser) return;
    void loadConfigs();
  }, [currentUser]);
  useEffect(() => { void loadLeads(); }, [quickFilter, currentUser]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLeads();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, statusFilter, sourceFilter, priorityFilter, tagFilter, sortOrder, startDate, endDate, configs.stages.length, branchFilter, agentFilter]);
  useEffect(() => {
    if (!selectedLead) return;
    setAiInstructions(selectedLead.ai_instructions ?? "");
    setEditTags(selectedLead.tags ?? []);
    if (leadSidebarTab === "activity") {
      void loadActivities(selectedLead.id);
    }
  }, [selectedLead?.id, selectedLead?.ai_instructions, leadSidebarTab]);

  const filteredLeads = useMemo(() => {
    return leads;
  }, [leads]);

  const groupedLeads = useMemo(() => {
    return dynamicStages.map((statusItem) => ({
      ...statusItem,
      leads: filteredLeads.filter((lead) => statusItem.id ? lead.lead_stage_id === statusItem.id : lead.status === statusItem.key),
    }));
  }, [dynamicStages, filteredLeads]);

  const topSources = useMemo(() => {
    return Object.entries(analytics?.by_source ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [analytics]);

  const availableTags = useMemo(() => {
    const set = new Set(suggestedTags);
    for (const lead of leads) {
      for (const tag of lead.tags ?? []) {
        if (tag) set.add(tag);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [leads]);

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

  function handleDrop(e: React.DragEvent, statusKey: string, stageId?: string) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId) {
      const lead = leads.find(l => l.id === leadId);
      if (lead && (stageId ? lead.lead_stage_id !== stageId : lead.status !== statusKey)) {
        void updateLead(leadId, stageId ? { lead_stage_id: stageId, status: statusKey } : { status: statusKey });
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
      setIndustry(orgTypeCode || result.industry || "");
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
          status: configs.stages.find((stage) => stage.id === leadStageId)?.name.toLowerCase().replace(/\s+/g, "_") || "new",
          lead_source_id: leadSourceId || null,
          lead_stage_id: leadStageId || null,
          lead_area_id: leadAreaId || null,
          priority: leadPriority,
          tags: leadTags.length ? leadTags : null,
          industry_data: industryData || null,
          raw_note: rawNotes || null,
          last_education: lastEducation || null,
          assigned_user_id: leadAssignedUserId || null,
          assigned_user_ids: leadAssignedUserIds.length ? leadAssignedUserIds : null,
        }),
      });
      setLastEducation("");
      setLeadAssignedUserIds([]);
      setLeadAssignedUserId("");
      setCompanyName("");
      setContactPerson("");
      setPhone("");
      setEmail("");
      setAddress("");
      setIndustry(orgTypeCode || "");
      setSource("manual");
      setLeadSourceId("");
      setLeadAreaId("");
      setLeadProfessionId("");
      setLeadPriority("");
      setLeadTags([]);
      setTagInput("");
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

  const updateEditIndustryField = (key: string, value: any) => {
    setEditIndustryData((prev) => ({
      ...(prev || {}),
      [key]: value,
    }));
  };

  const addLeadTags = (raw: string) => {
    const nextTags = splitTags(raw);
    if (nextTags.length) {
      setLeadTags((current) => mergeTags(current, nextTags));
    }
  };

  const addEditTags = (raw: string) => {
    const nextTags = splitTags(raw);
    if (nextTags.length) {
      setEditTags((current) => mergeTags(current, nextTags));
    }
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
      setEditModalLeadId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteLead(leadId: string) {
    const lead = leads.find((item) => item.id === leadId);
    const ok = window.confirm(`Delete ${lead?.company_name ?? "this lead"}?`);
    if (!ok) return;
    setSavingId(leadId);
    try {
      await apiRequest(`/leads/${leadId}`, { method: "DELETE" });
      await loadLeads();
      setSelectedId((current) => current === leadId ? null : current);
      setEditModalLeadId(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  const handleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map((l) => l.id));
    }
  };

  const handleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const bulkAssign = async (userId: string) => {
    if (selectedLeadIds.length === 0) return;
    setBulkUpdating(true);
    setBulkAssignOpen(false);
    try {
      await Promise.all(
        selectedLeadIds.map((id) =>
          apiRequest(`/leads/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ assigned_user_id: userId || null }),
          })
        )
      );
      await loadLeads();
      setSelectedLeadIds([]);
      setError(null);
    } catch (err) {
      setError(`Bulk assignment failed: ${(err as Error).message}`);
    } finally {
      setBulkUpdating(false);
    }
  };

  const bulkChangeStage = async (stageId: string) => {
    if (selectedLeadIds.length === 0) return;
    const stageName = configs.stages.find((s) => s.id === stageId)?.name;
    const statusVal = stageName
      ? stageName.toLowerCase().replace(/\s+/g, "_")
      : "new";
    setBulkUpdating(true);
    setBulkStageOpen(false);
    try {
      await Promise.all(
        selectedLeadIds.map((id) =>
          apiRequest(`/leads/${id}`, {
            method: "PATCH",
            body: JSON.stringify({
              lead_stage_id: stageId || null,
              status: statusVal,
            }),
          })
        )
      );
      await loadLeads();
      setSelectedLeadIds([]);
      setError(null);
    } catch (err) {
      setError(`Bulk stage change failed: ${(err as Error).message}`);
    } finally {
      setBulkUpdating(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedLeadIds.length === 0) return;
    const ok = window.confirm(`Delete all ${selectedLeadIds.length} selected leads?`);
    if (!ok) return;
    setBulkUpdating(true);
    try {
      await Promise.all(
        selectedLeadIds.map((id) =>
          apiRequest(`/leads/${id}`, {
            method: "DELETE",
          })
        )
      );
      await loadLeads();
      setSelectedLeadIds([]);
      setError(null);
    } catch (err) {
      setError(`Bulk deletion failed: ${(err as Error).message}`);
    } finally {
      setBulkUpdating(false);
    }
  };

  async function createLeadActivity(activityType: "call" | "message" | "follow_up") {
    if (!selectedLead || !activityNote.trim()) return;
    setSavingId(selectedLead.id);
    try {
      if (activityType === "message" && selectedLead.conversation_id) {
        await apiRequest(`/inbox/conversations/${selectedLead.conversation_id}/messages`, {
          method: "POST",
          body: JSON.stringify({
            content: activityNote,
            metadata: { lead_id: selectedLead.id, platform: activityPlatform },
          }),
        });
      } else {
        await apiRequest<LeadActivity>(`/leads/${selectedLead.id}/activities`, {
          method: "POST",
          body: JSON.stringify({
            activity_type: activityType,
            direction: activityType === "message" ? "outgoing" : activityPlatform === "phone" ? "outbound" : null,
            platform: activityPlatform,
            title: activityType === "call" ? "Call logged" : activityType === "follow_up" ? "Follow-up scheduled" : "Message note",
            content: activityNote,
            due_at: activityType === "follow_up" && followUpDate ? apiDate(followUpDate, true) : null,
          }),
        });
      }
      setActivityNote("");
      setFollowUpDate("");
      await Promise.all([loadActivities(selectedLead.id), loadLeads()]);
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

  async function handleShareLead(e: React.FormEvent) {
    e.preventDefault();
    if (!shareLeadId) return;
    setSharing(true);
    setShareError(null);
    try {
      const payload: any = { mode: shareMode };
      if (shareMode === "restricted") {
        const emails = shareEmails.split(",").map(em => em.trim()).filter(Boolean);
        if (emails.length === 0) throw new Error("Please enter at least one email address");
        payload.allowed_emails = emails;
      }
      
      const res = await apiRequest(`/leads/${shareLeadId}/share-links`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setShareLink((res as any).share_url);
    } catch (err: any) {
      setShareError(err.message);
    } finally {
      setSharing(false);
    }
  }

  async function handleBulkShareSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedLeadIds.length === 0) return;
    setBulkSharing(true);
    setBulkShareError(null);
    try {
      const payload: any = { mode: bulkShareMode };
      if (bulkShareMode === "restricted") {
        const emails = bulkShareEmails.split(",").map(em => em.trim()).filter(Boolean);
        if (emails.length === 0) throw new Error("Please enter at least one email address");
        payload.allowed_emails = emails;
      }
      
      const results: { company: string; url: string }[] = [];
      for (const id of selectedLeadIds) {
        const lead = leads.find(l => l.id === id);
        const companyName = lead?.company_name || lead?.contact_person || id.substring(0, 8);
        try {
          const res = await apiRequest<{ share_url: string }>(`/leads/${id}/share-links`, {
            method: "POST",
            body: JSON.stringify(payload)
          });
          results.push({ company: companyName, url: res.share_url });
        } catch (err: any) {
          results.push({ company: companyName, url: `Error: ${err.message}` });
        }
      }
      setBulkShareLinks(results);
    } catch (err: any) {
      setBulkShareError(err.message);
    } finally {
      setBulkSharing(false);
    }
  }

  async function loadLeadDetail(leadId: string) {
    try {
      const detailed = await apiRequest<Lead>(currentUser?.role === "agent" ? `/ai/assigned-leads/${leadId}` : `/leads/${leadId}`);
      setLeads((current) => {
        const exists = current.some((l) => l.id === detailed.id);
        if (exists) {
          return current.map((l) => (l.id === detailed.id ? detailed : l));
        }
        return [detailed, ...current];
      });
      if (detailed.converted_customer_id) {
        void loadCustomerDocuments(detailed.converted_customer_id);
      } else {
        setCustomerDocuments([]);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function loadCustomerDocuments(customerId: string) {
    try {
      const docs = await apiRequest<any[]>(`/documents?customer_id=${customerId}`);
      setCustomerDocuments(docs);
    } catch {
      setCustomerDocuments([]);
    }
  }

  function openLead(leadId: string) {
    // Ensure we have the canonical lead payload before showing details.
    void loadLeadDetail(leadId);
    setSelectedId(leadId);
    void loadLeadDocuments(leadId);
    const lead = leads.find(l => l.id === leadId);
    if (lead?.converted_customer_id) {
      void loadCustomerDocuments(lead.converted_customer_id);
    } else {
      setCustomerDocuments([]);
    }
  }

  async function loadLeadDocuments(leadId: string) {
    try {
      const docs = await apiRequest<any[]>(`/documents?lead_id=${leadId}`);
      setLeadDocuments(docs);
    } catch {
      setLeadDocuments([]);
    }
  }

  async function handleLeadDocUpload(fileType: string, file: File) {
    if (!selectedId) return;
    setLeadDocUploading(true);
    setLeadDocError(null);
    try {
      const formData = new FormData();
      formData.append("file_type", fileType);
      formData.append("lead_id", selectedId);
      formData.append("file", file);
      
      const newDoc = await apiRequest<any>("/documents/upload", {
        method: "POST",
        body: formData,
      });
      setLeadDocuments((prev) => [newDoc, ...prev]);
    } catch (err) {
      setLeadDocError((err as Error).message);
    } finally {
      setLeadDocUploading(false);
    }
  }

  async function handleDeleteLeadDoc(docId: string) {
    const ok = window.confirm("Are you sure you want to delete this document?");
    if (!ok) return;
    try {
      await apiRequest(`/documents/${docId}`, { method: "DELETE" });
      setLeadDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const getFullFileUrl = (relativeUrl: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";
    const host = apiBase.replace("/api/v1", "");
    return `${host}${relativeUrl}`;
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (statusFilter !== "all") params.set(configs.stages.some((stage) => stage.id === statusFilter) ? "stage_id" : "status", statusFilter);
    if (sourceFilter !== "all") params.set("source_id", sourceFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (tagFilter !== "all") params.set("tag", tagFilter);
    if (branchFilter !== "all") params.set("branch_id", branchFilter);
    if (agentFilter !== "all") params.set("assigned_user_id", agentFilter);
    if (startDate) params.set("start_date", apiDate(startDate));
    if (endDate) params.set("end_date", apiDate(endDate, true));
    
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";
    window.open(`${baseUrl}/leads/export?${params.toString()}`);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await apiRequest<{ success: boolean; imported_count: number; errors: string[] }>("/leads/bulk-upload", {
        method: "POST",
        body: formData
      });
      
      if (res.errors && res.errors.length > 0) {
        setError(`Imported ${res.imported_count} leads. Errors: ${res.errors.join("; ")}`);
      } else {
        alert(`Successfully imported ${res.imported_count} leads.`);
      }
      await loadLeads();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  function goToLead(leadId: string, tab: "details" | "edit" = "details") {
    router.push(`/leads?leadId=${encodeURIComponent(leadId)}&tab=${tab}`);
  }

  function renderLeadDetail(overlay = false) {
    if (!selectedLead) {
      return (
        <div className="grid min-h-72 place-items-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Add or select a lead to view details.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
              <Info size={12} className="text-slate-700 dark:text-slate-200" />
            </div>
            Basic Information
          </h4>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Name</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.company_name}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Phone</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.phone || "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Email</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.email || "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Source</span>
              <p className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{selectedSource?.name || selectedLead.source || "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Assigned To</span>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">
                  {users.find(u => u.id === selectedLead.assigned_user_id)?.name || selectedLead.assigned_user_id || "Unassigned"}
                </p>
                {(currentUser?.role === "admin" || currentUser?.role === "super_admin") && (
                  <select
                    value={selectedLead.assigned_user_id || ""}
                    onChange={(e) => void updateLead(selectedLead.id, { assigned_user_id: e.target.value || null })}
                    className="h-8 rounded-lg border border-white/50 bg-white/50 px-2 py-0.5 text-xs text-slate-700 outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                  >
                    <option value="">Assign...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.email || u.id}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Location</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedArea?.name || "N/A"}</p>
            </div>
            <div className="col-span-3">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Address</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.address || "N/A"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
              <Flag size={12} className="text-slate-700 dark:text-slate-200" />
            </div>
            Lead Status
          </h4>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Stage</span>
              <span className="inline-block rounded bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">
                {selectedStage?.name || selectedLead.status || "N/A"}
              </span>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Priority</span>
              <p className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{selectedLead.priority || "medium"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Interest Level</span>
              <p className="text-sm font-semibold capitalize text-slate-900 dark:text-white">{selectedLead.intent || selectedLead.tags?.[0] || "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Budget</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.budget_max ? `BDT ${selectedLead.budget_max}` : ((selectedLead.industry_data as any)?.budget || "N/A")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
              <Calendar size={12} className="text-slate-700 dark:text-slate-200" />
            </div>
            Follow-up
          </h4>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Last Contacted</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.updated_at ? formatDate(selectedLead.updated_at) : "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Next Follow-up</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                 {activities.find(a => a.due_at)?.due_at ? formatDate(activities.find(a => a.due_at)!.due_at!) : "N/A"}
              </p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Converted</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.converted_customer_id ? "Yes" : "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Lost</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.status === "lost" ? "Yes" : "N/A"}</p>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                {orgTypeCode === "study_abroad" ? "Last Education" : "Profession"}
              </span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {orgTypeCode === "study_abroad"
                  ? (selectedLead.last_education || "N/A")
                  : (selectedProfession?.name || "N/A")}
              </p>
            </div>
            <div className="col-span-2">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Remarks</span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedLead.raw_note || "Nothing"}</p>
            </div>
            <div className="col-span-3">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">Lost Reason</span>
              <p className="text-sm font-semibold text-rose-500">N/A</p>
            </div>
          </div>
        </div>

        {orgTypeCode === "study_abroad" && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5 text-left">
            <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
                <Globe size={12} className="text-slate-700 dark:text-slate-200" />
              </div>
              Study Abroad Custom Data
            </h4>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">Preferred Country</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{(selectedLead.industry_data as any)?.preferred_country || "N/A"}</p>
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">Financial Status</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{(selectedLead.industry_data as any)?.financial_status || "N/A"}</p>
              </div>
              <div className="col-span-3">
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">Countries Applied For</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {((selectedLead.industry_data as any)?.countries_applied as string[] || []).length > 0 ? (
                    ((selectedLead.industry_data as any)?.countries_applied as string[]).map((country) => (
                      <span key={country} className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                        {country}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">None specified</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {orgTypeCode === "real_estate" && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5 text-left">
            <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
                <Globe size={12} className="text-slate-700 dark:text-slate-200" />
              </div>
              Real Estate Custom Data
            </h4>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">Budget (BDT)</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{(selectedLead.industry_data as any)?.budget || "N/A"}</p>
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">Square Feet</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{(selectedLead.industry_data as any)?.square_feet || "N/A"}</p>
              </div>
            </div>
          </div>
        )}

        {orgTypeCode === "ecommerce" && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5 text-left">
            <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
                <Globe size={12} className="text-slate-700 dark:text-slate-200" />
              </div>
              Ecommerce Custom Data
            </h4>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">Product Interest</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{(selectedLead.industry_data as any)?.product_interest || "N/A"}</p>
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">Delivery Location</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{(selectedLead.industry_data as any)?.delivery_location || "N/A"}</p>
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">Urgency Level</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{(selectedLead.industry_data as any)?.urgency_level || "N/A"}</p>
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">Preferred Platform</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{(selectedLead.industry_data as any)?.preferred_platform || "N/A"}</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5 text-left">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
              <FileText size={12} className="text-slate-700 dark:text-slate-200" />
            </div>
            Documents & Attachments (IELTS, Passport, NID, etc.)
          </h4>

          {leadDocError && (
            <div className="mb-3 text-xs text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">{leadDocError}</div>
          )}

          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-white/50 bg-white/20 dark:bg-white/5 dark:border-white/10 mb-4">
            <select
              id="counselor_doc_type"
              defaultValue="passport"
              className="h-10 px-3 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500"
            >
              <option value="passport">Passport</option>
              <option value="nid">National ID (NID)</option>
              <option value="ielts">IELTS Score Card</option>
              <option value="medical">Medical Report</option>
              <option value="certificates">Academic Certificates</option>
              <option value="other">Other Supporting File</option>
            </select>
            
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                const docType = (document.getElementById("counselor_doc_type") as HTMLSelectElement)?.value || "passport";
                if (file) {
                  void handleLeadDocUpload(docType, file);
                }
              }}
              className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-500/10 file:text-brand-600 hover:file:bg-brand-500/20 cursor-pointer"
            />
            {leadDocUploading && <Loader2 size={16} className="animate-spin text-brand-500" />}
          </div>

          {leadDocuments.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-4">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {leadDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-white/20 bg-white/30 dark:bg-white/5 dark:border-white/10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText size={14} className="text-brand-500" />
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={doc.name}>
                        {doc.name}
                      </span>
                      <span className="block text-[9px] font-extrabold uppercase text-slate-500 mt-0.5">
                        {doc.file_type}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <a
                      href={getFullFileUrl(doc.file_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs transition-colors"
                      title="Open file"
                    >
                      <Globe size={11} />
                    </a>
                    <button
                      onClick={() => void handleDeleteLeadDoc(doc.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs transition-colors"
                      title="Delete document"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedLead.converted_customer_id && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5 text-left">
            <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500 text-white">
                <Globe size={12} className="text-white" />
              </div>
              Customer Portal Documents
            </h4>
            
            {customerDocuments.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-4">No documents uploaded by customer yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {customerDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-white/20 bg-white/30 dark:bg-white/5 dark:border-white/10">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText size={14} className="text-brand-500" />
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={doc.name}>
                          {doc.name}
                        </span>
                        <span className="block text-[9px] font-extrabold uppercase text-slate-500 mt-0.5">
                          {doc.file_type}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <a
                        href={getFullFileUrl(doc.file_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs transition-colors"
                        title="Open file"
                      >
                        <Globe size={11} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 sm:h-10"
            >
              Export
            </button>
            <label className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer sm:h-10">
              Import CSV
              <input type="file" accept=".csv" onChange={handleBulkUpload} className="hidden" />
            </label>
            <button
              onClick={() => { setError(null); setCreateLeadOpen(true); }}
              className="flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white shadow-glow transition hover:bg-brand-500 sm:h-10"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Create New Lead</span>
            </button>
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

        <div className="mb-6 flex gap-6 overflow-x-auto border-b border-white/20 dark:border-white/10 hide-scrollbar">
          {[
            { id: "all", label: "All Leads" },
            { id: "assigned", label: "Assigned to Me" },
            { id: "untouched", label: "Untouched Leads" },
            { id: "followup", label: "Follow-ups Due" },
          ].filter(f => !(f.id === "assigned" && (currentUser?.role === "admin" || currentUser?.role === "super_admin"))).map(f => (
            <button 
              key={f.id}
              onClick={() => setQuickFilter(f.id)}
              className={`whitespace-nowrap pb-3 text-sm font-semibold transition-colors ${
                quickFilter === f.id 
                  ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 backdrop-blur-md dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        {/* Stats — admins see global analytics, agents see only their assigned count */}
        {(currentUser?.role === "admin" || currentUser?.role === "super_admin") ? (
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
        ) : (
          <div className="mb-5 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">My Assigned Leads</span>
                <Zap size={17} className="text-brand-500" />
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                {leads.filter((l) => l.status !== "lost" && l.status !== "won").length}
              </p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">My Converted</span>
                <CheckCircle2 size={17} className="text-emerald-500" />
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                {leads.filter((l) => l.converted_customer_id).length}
              </p>
            </div>
          </div>
        )}

        {createLeadOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/95">
              <form onSubmit={createLead} className="overflow-hidden">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-white/20 px-6 py-4 backdrop-blur-xl dark:bg-white/5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Create New Lead</h3>
                  <button type="button" onClick={() => { setError(null); setCreateLeadOpen(false); }} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 dark:text-slate-400">
                    <X size={20} />
                  </button>
                </div>

          <div className="p-6">
            {error ? (
              <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 backdrop-blur-md dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                {error}
              </p>
            ) : null}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Identity Section */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">Identity</p>
                <div className="space-y-3">
                  <label className="relative block">
                    <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      name="company_name"
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
                      name="contact_person"
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
                      name="phone"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="h-11 w-full rounded-xl border border-white/40 bg-white/50 py-2 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/30 dark:text-white"
                      placeholder="Phone Number"
                    />
                  </label>
                  {phoneWarning && (
                    <p className="text-[11px] font-semibold text-rose-500 mt-1 dark:text-rose-400">
                      ⚠️ {phoneWarning}
                    </p>
                  )}
                  <label className="relative block">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      name="email"
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
                      name="lead_source_id"
                      value={leadSourceId}
                      onChange={(value) => {
                        setLeadSourceId(value);
                        setSource(configs.sources.find((item) => item.id === value)?.name || "manual");
                      }}
                      icon={Globe}
                      placeholder="Source"
                      options={[
                        { value: "", label: "Manual" },
                        ...configs.sources.map((item) => ({ value: item.id, label: item.name })),
                      ]}
                    />
                    <ThemedSelect
                      name="lead_stage_id"
                      value={leadStageId}
                      onChange={setLeadStageId}
                      icon={Filter}
                      placeholder="Lead Stage"
                      options={configs.stages.map((item) => ({ value: item.id, label: item.name }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ThemedSelect
                      name="priority"
                      value={leadPriority}
                      onChange={setLeadPriority}
                      icon={Zap}
                      placeholder="Lead Priority"
                      options={[
                        { value: "high", label: "High" },
                        { value: "medium", label: "Medium" },
                        { value: "low", label: "Low" },
                      ]}
                    />
                    <ThemedSelect
                      name="lead_area_id"
                      value={leadAreaId}
                      onChange={setLeadAreaId}
                      icon={Globe}
                      placeholder="Location"
                      options={[{ value: "", label: "No Location" }, ...configs.areas.map((item) => ({ value: item.id, label: item.name }))]}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {orgTypeCode === "study_abroad" ? (
                      <label className="relative block">
                        <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          name="last_education"
                          value={lastEducation}
                          onChange={(event) => setLastEducation(event.target.value)}
                          className="h-11 w-full rounded-xl border border-white/40 bg-white/50 py-2 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/30 dark:text-white"
                          placeholder="Last Education"
                        />
                      </label>
                    ) : (
                      <ThemedSelect
                        name="lead_profession_id"
                        value={leadProfessionId}
                        onChange={setLeadProfessionId}
                        icon={Briefcase}
                        placeholder="Profession"
                        options={[{ value: "", label: "No Profession" }, ...configs.professions.map((item) => ({ value: item.id, label: item.name }))]}
                      />
                    )}
                    <ThemedSelect
                      name="assigned_user_id"
                      value={leadAssignedUserId}
                      onChange={setLeadAssignedUserId}
                      icon={User}
                      placeholder="Assigned To"
                      options={[{ value: "", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name || u.email || u.id }))]}
                    />
                  </div>
                  <label className="relative block">
                    <FileText size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      className="h-11 w-full rounded-xl border border-white/40 bg-white/50 py-2 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/30 dark:text-white"
                      placeholder="Precise Address (e.g. House, Road)"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/20 bg-white/30 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">Tags</p>
                <span className="text-[10px] text-slate-400">Press Enter or comma to add</span>
              </div>
              <label className="block">
                <input
                  name="tags"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault();
                      addLeadTags(tagInput);
                      setTagInput("");
                    }
                  }}
                  className="h-10 w-full rounded-xl border border-white/40 bg-white/60 px-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/30 dark:text-white"
                  placeholder="vip, hot, follow-up"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {leadTags.length ? (
                  leadTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setLeadTags((current) => current.filter((item) => item !== tag))}
                      className="flex items-center gap-1 rounded-full bg-brand-500/10 px-3 py-1 text-[11px] font-semibold text-brand-600 transition hover:bg-brand-500/20 dark:text-brand-300"
                    >
                      {tagLabel(tag)}
                      <X size={12} />
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">No tags yet</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setLeadTags((current) => mergeTags(current, [tag]))}
                    className="rounded-full border border-white/30 bg-white/60 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                  >
                    + {tagLabel(tag)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/20 bg-white/30 p-4 dark:border-white/10 dark:bg-white/5 text-left animate-fade-up">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-brand-500">Collaborating Counselor Assignments</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1 max-h-32 overflow-y-auto p-2.5 bg-white/20 dark:bg-black/20 rounded-xl">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={leadAssignedUserIds.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setLeadAssignedUserIds([...leadAssignedUserIds, u.id]);
                        } else {
                          setLeadAssignedUserIds(leadAssignedUserIds.filter(id => id !== u.id));
                        }
                      }}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
                    />
                    <span>{u.name || u.email || u.id}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Dynamic Industry Context Section */}
            {(industry || orgTypeCode === "study_abroad") && (
              <div className="mt-8 animate-fade-up">
                <div className="rounded-2xl border border-brand-200/50 bg-brand-50/30 p-5 dark:border-brand-500/20 dark:bg-brand-500/5">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500 text-white">
                      <Sparkles size={12} />
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
                      Contextual Details: {(industry || orgTypeCode || "").replace(/_/g, " ")}
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

                    {(industry === "study_abroad" || orgTypeCode === "study_abroad") && (
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
                        <div className="col-span-2">
                          <label className="block text-left mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            Countries Applied For
                          </label>
                          <input
                            value={countryInput}
                            onChange={(e) => setCountryInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === ",") {
                                e.preventDefault();
                                const nextVal = e.currentTarget.value.trim();
                                if (nextVal) {
                                  const existing = (industryData?.countries_applied as string[]) || [];
                                  if (!existing.includes(nextVal)) {
                                    updateIndustryField("countries_applied", [...existing, nextVal]);
                                  }
                                }
                                setCountryInput("");
                              }
                            }}
                            className="h-10 w-full rounded-xl border border-white/40 bg-white/60 px-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 dark:border-white/10 dark:bg-black/30 dark:text-white"
                            placeholder="Type country and press Enter/comma"
                          />
                          <div className="mt-2 flex flex-wrap gap-1">
                            {((industryData?.countries_applied as string[]) || []).map((country) => (
                              <span key={country} className="flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                                {country}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const existing = (industryData?.countries_applied as string[]) || [];
                                    updateIndustryField("countries_applied", existing.filter(c => c !== country));
                                  }}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <X size={8} />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
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
              <div className="flex-1">
                <div className="mb-4 flex items-center gap-2 cursor-pointer" onClick={() => setExtraInfoMenuOpen(!extraInfoMenuOpen)}>
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/20 text-brand-600 dark:bg-brand-500/40 dark:text-brand-300">
                    <Plus size={14} className={extraInfoMenuOpen ? 'rotate-45 transition-transform' : 'transition-transform'} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Additional Information</h4>
                </div>
                {extraInfoMenuOpen && (
                  <div className="grid gap-4 sm:grid-cols-2 animate-fade-down pr-8">
                    {additionalInfoOptions.map(opt => (
                      <label key={opt.key} className="block text-left">
                        <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">{opt.label}</span>
                        <input
                          value={extraInfoValues[opt.key] || ''}
                          onChange={e => setExtraInfoValues(prev => ({ ...prev, [opt.key]: e.target.value }))}
                          className="h-10 w-full rounded-xl border border-white/40 bg-white/50 px-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-white/10 dark:bg-black/30 dark:text-white"
                          placeholder={`Enter ${opt.label.toLowerCase()}`}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !!phoneWarning}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-8 text-sm font-bold text-white shadow-glow transition hover:from-brand-600 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-60 sm:w-auto"
              >
                <Plus size={18} />
                {loading ? "Creating Lead..." : "Create New Lead"}
              </button>
            </div>
          </div>
        </form>
            </div>
          </div>
        )}

        <div className="mb-5 grid min-w-0 gap-3">
          <div className="min-w-0 space-y-3">
            <div className="glass-card relative z-30 flex flex-wrap items-center gap-3 p-3">
              <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/50 bg-white/50 px-3 dark:border-white/10 dark:bg-black/20 sm:h-10 sm:min-w-[220px]">
                <Search size={15} className="text-slate-500 shrink-0" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                  placeholder="Search by name | phone | email"
                  type="search"
                />
              </div>
              <div className={`flex w-full flex-wrap items-center gap-2 sm:w-auto`}>
                <ThemedSelect
                  value={branchFilter}
                  onChange={setBranchFilter}
                  icon={Building2}
                  placeholder="-- Branch --"
                  className="w-40 h-10"
                  options={[
                    { value: "all", label: "-- Branch --" },
                    ...branches.map((b) => ({ value: b.id, label: b.name })),
                  ]}
                />
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="h-10 rounded-xl border border-white/50 bg-white/50 px-3 text-xs font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-black/20 dark:text-slate-200"
                >
                  <option value="all">-- Agent --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.email || u.id}</option>
                  ))}
                </select>
                <ThemedSelect 
                  value={statusFilter} 
                  onChange={setStatusFilter}
                  icon={Filter}
                  placeholder="-- Stage --"
                  className="w-48 h-10"
                  options={[
                    { value: "all", label: "-- Stage --" },
                    ...(configs.stages.length
                      ? configs.stages.map((s) => ({ value: s.id, label: s.name }))
                      : statuses.map((s) => ({ value: s.key, label: s.label })))
                  ]}
                />
                <ThemedSelect
                  value={sourceFilter}
                  onChange={setSourceFilter}
                  icon={Globe}
                  placeholder="-- Source --"
                  className="w-44 h-10"
                  options={[
                    { value: "all", label: "-- Source --" },
                    ...configs.sources.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
                <ThemedSelect
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  icon={Zap}
                  placeholder="-- Priority --"
                  className="w-40 h-10"
                  options={[
                    { value: "all", label: "-- Priority --" },
                    { value: "high", label: "High" },
                    { value: "medium", label: "Medium" },
                    { value: "low", label: "Low" },
                  ]}
                />
                <ThemedSelect
                  value={tagFilter}
                  onChange={setTagFilter}
                  icon={Filter}
                  placeholder="-- Tag --"
                  className="w-40 h-10"
                  options={[
                    { value: "all", label: "-- Tag --" },
                    ...availableTags.map((tag) => ({ value: tag, label: tagLabel(tag) })),
                  ]}
                />
                <ThemedSelect 
                  value={sortOrder} 
                  onChange={setSortOrder}
                  icon={ArrowRight}
                  placeholder="-- Sort By Date --"
                  className="w-48 h-10"
                  options={[
                    { value: "desc", label: "-- Sort By Date --" },
                    { value: "asc", label: "Oldest First" }
                  ]}
                />
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-700 outline-none dark:border-white/10 dark:bg-black/20 dark:text-slate-200" />
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-700 outline-none dark:border-white/10 dark:bg-black/20 dark:text-slate-200" />
                <button type="button" onClick={() => void loadLeads()} className="h-10 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-500">
                  Filter
                </button>
              </div>
            </div>

            {viewMode === "board" ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                {groupedLeads.map((column) => (
                  <section 
                    key={column.key} 
                    className="glass-card min-h-64 p-3"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, column.key, column.id)}
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
                          {lead.tags?.length ? (
                            <span className="mt-2 flex flex-wrap gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              {lead.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600 dark:text-brand-300">
                                  {tagLabel(tag)}
                                </span>
                              ))}
                            </span>
                          ) : null}
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
                          {lead.tags?.length ? (
                            <p className="mt-2 flex flex-wrap gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              {lead.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600 dark:text-brand-300">
                                  {tagLabel(tag)}
                                </span>
                              ))}
                            </p>
                          ) : null}
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

                <div className="hidden overflow-x-auto glass-card md:block rounded-xl">
                  <table className="min-w-full whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-white/20 bg-white/20 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                      <th className="px-5 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={filteredLeads.length > 0 && selectedLeadIds.length === filteredLeads.length}
                          onChange={handleSelectAll}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                        />
                      </th>
                      <th className="px-5 py-4 w-12 text-center">#</th>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4">Name</th>
                      <th className="px-5 py-4">Phone</th>
                      <th className="px-5 py-4">{orgTypeCode === "study_abroad" ? "Last Education" : "Profession"}</th>
                      <th className="px-5 py-4">Location</th>
                      <th className="px-5 py-4">Stage</th>
                      <th className="px-5 py-4">Assigned To</th>
                      <th className="px-5 py-4">Source</th>
                      <th className="px-5 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredLeads.map((lead, index) => {
                      const isSelected = selectedLeadIds.includes(lead.id);
                      return (
                        <tr
                          key={lead.id}
                          onClick={() => { openLead(lead.id); }}
                          className={`cursor-pointer transition hover:bg-white/40 dark:hover:bg-white/10 ${
                            isSelected 
                              ? "bg-brand-500/10 dark:bg-brand-500/15" 
                              : selectedId === lead.id 
                                ? "bg-brand-500/8 dark:bg-brand-500/10 ring-1 ring-inset ring-brand-500/20" 
                                : ""
                          }`}
                        >
                          <td className="px-5 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectLead(lead.id)}
                              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                            />
                          </td>
                          <td className="px-5 py-4 w-12 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {index + 1}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{formatDate(lead.created_at)}</td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                              {lead.untouched ? <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-300">NEW</span> : null}
                              {lead.company_name}
                            </div>
                            {lead.tags?.length ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {lead.tags.slice(0, 3).map((tag) => (
                                  <span key={tag} className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600 dark:text-brand-300">
                                    {tagLabel(tag)}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{lead.phone || "-"}</td>
                          <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300 capitalize">
                             {orgTypeCode === "study_abroad" 
                               ? (lead.last_education || "—") 
                               : (configs.professions.find((p) => p.id === lead.lead_profession_id)?.name || "—")}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                             {configs.areas.find((area) => area.id === lead.lead_area_id)?.name || "—"}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${stageTone(configs.stages.find((item) => item.id === lead.lead_stage_id)?.name, lead.status)}`}>
                              {configs.stages.find((item) => item.id === lead.lead_stage_id)?.name ?? lead.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                            {users.find(u => u.id === lead.assigned_user_id)?.name || lead.assigned_user_id || "Unassigned"}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300 capitalize">
                            <div className="flex items-center gap-1.5">
                              <SourceIcon source={lead.source} className="h-4 w-4 text-brand-500 shrink-0" />
                              <span>{configs.sources.find(s => s.id === lead.lead_source_id)?.name || lead.source || "unsourced"}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5 text-slate-400">
                              <button onClick={() => { openLead(lead.id); }} className="rounded p-1.5 hover:bg-white/60 hover:text-brand-500 dark:hover:bg-white/10">
                                <Eye size={16} />
                              </button>
                              {(currentUser?.role === "admin" || currentUser?.role === "super_admin") && (
                                <button onClick={() => void deleteLead(lead.id)} className="rounded p-1.5 hover:bg-rose-500/10 hover:text-rose-500">
                                  <Trash2 size={16} />
                                </button>
                              )}
                              <div className="relative">
                                <button onClick={(e) => { e.stopPropagation(); setActionDropdownId(actionDropdownId === lead.id ? null : lead.id) }} className="rounded p-1.5 hover:bg-white/60 hover:text-emerald-500 dark:hover:bg-white/10">
                                  <Edit2 size={16} />
                                </button>
                                {actionDropdownId === lead.id && (
                                  <div className="absolute right-0 top-full mt-1 w-40 rounded-xl bg-white shadow-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700 z-50 overflow-hidden text-left" onMouseLeave={() => setActionDropdownId(null)}>
                                    <button onClick={(e) => { e.stopPropagation(); setError(null); setEditModalLeadId(lead.id); setActionDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 flex items-center gap-2"><Edit2 size={14} /> Edit Lead</button>
                                    {(currentUser?.role === "admin" || currentUser?.role === "super_admin") && (
                                      <button onClick={(e) => { e.stopPropagation(); setBudgetModalLeadId(lead.id); setActionDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2"><CheckCircle2 size={14} /> Convert</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>

        </div>
              {selectedLead ? (
          <div className="fixed inset-0 z-[100] flex justify-center items-center p-4 bg-slate-950/40 backdrop-blur-sm transition-opacity">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Lead detail"
              className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 animate-scale-in border border-white/20 dark:border-white/10"
            >
              {/* Header with sticky close button */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-white/20 px-6 py-4 backdrop-blur-xl dark:bg-white/5">
                 <div>
                   <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                     <Smartphone size={16} /> Lead Details - {selectedLead.id.substring(0, 8).toUpperCase()}
                   </h3>
                   <p className="mt-1 text-[10px] text-slate-500">Created by {users.find(u => u.id === selectedLead.assigned_user_id)?.name || "Super Admin"} | {formatDate(selectedLead.created_at)}</p>
                 </div>
                 <button 
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10"
                 >
                  <X size={20} />
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {renderLeadDetail(true)}
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </section>


      {editModalLeadId && (() => {
        const selectedLead = leads.find(l => l.id === editModalLeadId);
        if (!selectedLead) return null;
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/20 bg-white shadow-2xl dark:bg-slate-900 animate-fade-up">
              {/* Header with sticky close button */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/80 px-6 py-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Lead</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{selectedLead.company_name}</p>
                </div>
                <button onClick={() => { setError(null); setEditModalLeadId(null); }} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable form container */}
              <div className="flex-1 overflow-y-auto p-6">
                {error ? (
                  <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 backdrop-blur-md dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                    {error}
                  </p>
                ) : null}

                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const stageId = String(form.get("lead_stage_id") || "");
                    const professionId = form.get("lead_profession_id") ? String(form.get("lead_profession_id")) : "";
                    void updateLead(selectedLead.id, {
                      company_name: String(form.get("company_name") || selectedLead.company_name),
                      contact_person: String(form.get("contact_person") || "") || null,
                      phone: String(form.get("phone") || "") || null,
                      email: String(form.get("email") || "") || null,
                      priority: String(form.get("priority") || "medium"),
                      lead_stage_id: stageId || null,
                      lead_area_id: String(form.get("lead_area_id") || "") || null,
                      last_education: String(form.get("last_education") || "") || null,
                      lead_profession_id: professionId || null,
                      assigned_user_id: String(form.get("assigned_user_id") || "") || null,
                      assigned_user_ids: editAssignedUserIds,
                      lead_source_id: String(form.get("lead_source_id") || "") || null,
                      address: String(form.get("address") || "") || null,
                      tags: editTags,
                      ai_instructions: aiInstructions || null,
                      industry_data: editIndustryData || null,
                      status: configs.stages.find((stage) => stage.id === stageId)?.name.toLowerCase().replace(/\s+/g, "_") || selectedLead.status,
                    });
                  }}
                >
                  {/* Basic Information Card */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                    <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
                        <Info size={12} className="text-slate-700 dark:text-slate-200" />
                      </div>
                      Basic Information
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className="block text-left">
                        <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Company Name</span>
                        <input name="company_name" defaultValue={selectedLead.company_name} className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                      </label>
                      <label className="block text-left">
                        <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Contact Person</span>
                        <input name="contact_person" defaultValue={selectedLead.contact_person ?? ""} className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                      </label>
                      <label className="block text-left">
                        <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Phone</span>
                        <input
                          name="phone"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                        />
                        {editPhoneWarning && (
                          <p className="text-[11px] font-semibold text-rose-500 mt-1 dark:text-rose-400">
                            ⚠️ {editPhoneWarning}
                          </p>
                        )}
                      </label>
                      <label className="block text-left">
                        <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Email</span>
                        <input name="email" defaultValue={selectedLead.email ?? ""} className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                      </label>
                      <label className="block text-left">
                        <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Source</span>
                        <UncontrolledThemedSelect
                          name="lead_source_id"
                          defaultValue={selectedLead.lead_source_id ?? ""}
                          placeholder="Source"
                          icon={Globe}
                          options={[{ value: "", label: "Manual" }, ...configs.sources.map((s) => ({ value: s.id, label: s.name }))]}
                        />
                      </label>
                      <label className="block text-left">
                        <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Assigned To</span>
                        <UncontrolledThemedSelect
                          name="assigned_user_id"
                          defaultValue={selectedLead.assigned_user_id ?? ""}
                          placeholder="Unassigned"
                          icon={User}
                          options={[{ value: "", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name || u.email || u.id }))]}
                        />
                      </label>
                      <label className="block text-left">
                        <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Location</span>
                        <UncontrolledThemedSelect
                          name="lead_area_id"
                          defaultValue={selectedLead.lead_area_id ?? ""}
                          placeholder="Location"
                          icon={Globe}
                          options={[{ value: "", label: "No Location" }, ...configs.areas.map((area) => ({ value: area.id, label: area.name }))]}
                        />
                      </label>
                      <label className="block text-left md:col-span-2">
                        <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Address</span>
                        <input name="address" defaultValue={selectedLead.address ?? ""} placeholder="Precise Address (e.g. House, Road)" className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                      </label>
                    </div>
                  </div>

                  {/* Lead Status and Tags & Instructions side-by-side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Lead Status Card */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5 text-left">
                      <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
                          <Flag size={12} className="text-slate-700 dark:text-slate-200" />
                        </div>
                        Lead Status
                      </h4>
                      <div className="space-y-4">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Stage</span>
                          <UncontrolledThemedSelect
                            name="lead_stage_id"
                            defaultValue={selectedLead.lead_stage_id ?? ""}
                            placeholder="Stage"
                            icon={Filter}
                            options={[{ value: "", label: "No Stage" }, ...configs.stages.map((stage) => ({ value: stage.id, label: stage.name }))]}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Priority</span>
                          <UncontrolledThemedSelect
                            name="priority"
                            defaultValue={selectedLead.priority ?? "medium"}
                            placeholder="Priority"
                            icon={Zap}
                            options={[
                              { value: "high", label: "High" },
                              { value: "medium", label: "Medium" },
                              { value: "low", label: "Low" },
                            ]}
                          />
                        </label>
                        {orgTypeCode === "study_abroad" ? (
                          <label className="block text-left">
                            <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Last Education</span>
                            <input
                              name="last_education"
                              defaultValue={selectedLead.last_education ?? ""}
                              className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                              placeholder="Last Education"
                            />
                          </label>
                        ) : (
                          <label className="block text-left">
                            <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Profession</span>
                            <UncontrolledThemedSelect
                              name="lead_profession_id"
                              defaultValue={selectedLead.lead_profession_id ?? ""}
                              placeholder="Profession"
                              icon={Briefcase}
                              options={[{ value: "", label: "No Profession" }, ...configs.professions.map((item) => ({ value: item.id, label: item.name }))]}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Tags & Instructions Card */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5 flex flex-col justify-between text-left">
                      <div>
                        <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
                            <Sparkles size={12} className="text-slate-700 dark:text-slate-200" />
                          </div>
                          Tags & Instructions
                        </h4>

                        <div className="rounded-xl border border-white/20 bg-white/30 p-3 dark:border-white/10 dark:bg-white/5 mb-4">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase text-slate-500">Tags</span>
                            <span className="text-[9px] text-slate-400">Press Enter or comma</span>
                          </div>
                          <input
                            value={editTagInput}
                            onChange={(event) => setEditTagInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === ",") {
                                event.preventDefault();
                                addEditTags(editTagInput);
                                setEditTagInput("");
                              }
                            }}
                            className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                            placeholder="vip, hot, follow-up"
                          />
                          <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                            {editTags.length ? (
                              editTags.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => setEditTags((current) => current.filter((item) => item !== tag))}
                                  className="flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-600 transition hover:bg-brand-500/20 dark:text-brand-300"
                                >
                                  {tagLabel(tag)}
                                  <X size={10} />
                                </button>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">No tags yet</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <label className="block text-left">
                        <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">AI Instructions</span>
                        <textarea value={aiInstructions} onChange={(event) => setAiInstructions(event.target.value)} rows={2} className="w-full rounded-xl border border-white/50 bg-white/50 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                      </label>

                      <div className="col-span-1 md:col-span-2 mt-4 text-left">
                        <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Collaborating Counselor Assignments</span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1 max-h-32 overflow-y-auto p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-white/50 dark:border-white/10">
                          {users.map((u) => (
                            <label key={u.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editAssignedUserIds.includes(u.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditAssignedUserIds([...editAssignedUserIds, u.id]);
                                  } else {
                                    setEditAssignedUserIds(editAssignedUserIds.filter(id => id !== u.id));
                                  }
                                }}
                                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
                              />
                              <span>{u.name || u.email || u.id}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {orgTypeCode === "study_abroad" && (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5 text-left mt-4">
                          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
                              <Sparkles size={12} className="text-slate-700 dark:text-slate-200" />
                            </div>
                            Study Abroad Context Details
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="block text-left">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Preferred Country</span>
                              <select
                                value={(editIndustryData?.preferred_country as string) || ""}
                                onChange={(e) => updateEditIndustryField("preferred_country", e.target.value)}
                                className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                              >
                                <option value="">Select Country</option>
                                <option value="UK">UK</option>
                                <option value="US">US</option>
                                <option value="AUS">AUS</option>
                                <option value="CA">CA</option>
                              </select>
                            </label>
                            <label className="block text-left">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Financial Status</span>
                              <input
                                value={(editIndustryData?.financial_status as string) || ""}
                                onChange={(e) => updateEditIndustryField("financial_status", e.target.value)}
                                className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                              />
                            </label>
                            <div className="col-span-2">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Countries Applied For</span>
                              <input
                                value={editCountryInput}
                                onChange={(e) => setEditCountryInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === ",") {
                                    e.preventDefault();
                                    const nextVal = e.currentTarget.value.trim();
                                    if (nextVal) {
                                      const existing = (editIndustryData?.countries_applied as string[]) || [];
                                      if (!existing.includes(nextVal)) {
                                        updateEditIndustryField("countries_applied", [...existing, nextVal]);
                                      }
                                    }
                                    setEditCountryInput("");
                                  }
                                }}
                                className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                                placeholder="Type country and press Enter/comma"
                              />
                              <div className="mt-2 flex flex-wrap gap-1">
                                {((editIndustryData?.countries_applied as string[]) || []).map((country) => (
                                  <span key={country} className="flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                                    {country}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const existing = (editIndustryData?.countries_applied as string[]) || [];
                                        updateEditIndustryField("countries_applied", existing.filter(c => c !== country));
                                      }}
                                      className="text-slate-400 hover:text-slate-600"
                                    >
                                      <X size={8} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {orgTypeCode === "real_estate" && (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5 text-left mt-4">
                          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
                              <Sparkles size={12} className="text-slate-700 dark:text-slate-200" />
                            </div>
                            Real Estate Context Details
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="block text-left">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Budget (BDT)</span>
                              <input
                                type="number"
                                value={(editIndustryData?.budget as string) || ""}
                                onChange={(e) => updateEditIndustryField("budget", e.target.value)}
                                className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                              />
                            </label>
                            <label className="block text-left">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Square Feet</span>
                              <input
                                type="number"
                                value={(editIndustryData?.square_feet as string) || ""}
                                onChange={(e) => updateEditIndustryField("square_feet", e.target.value)}
                                className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                      {orgTypeCode === "ecommerce" && (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5 text-left mt-4">
                          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                            <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
                              <Sparkles size={12} className="text-slate-700 dark:text-slate-200" />
                            </div>
                            Ecommerce Context Details
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="block text-left">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Product Interest</span>
                              <input
                                value={(editIndustryData?.product_interest as string) || ""}
                                onChange={(e) => updateEditIndustryField("product_interest", e.target.value)}
                                className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                              />
                            </label>
                            <label className="block text-left">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Delivery Location</span>
                              <input
                                value={(editIndustryData?.delivery_location as string) || ""}
                                onChange={(e) => updateEditIndustryField("delivery_location", e.target.value)}
                                className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                              />
                            </label>
                            <label className="block text-left">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Urgency Level</span>
                              <select
                                value={(editIndustryData?.urgency_level as string) || ""}
                                onChange={(e) => updateEditIndustryField("urgency_level", e.target.value)}
                                className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                              >
                                <option value="">Select Urgency</option>
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                              </select>
                            </label>
                            <label className="block text-left">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Preferred Platform</span>
                              <select
                                value={(editIndustryData?.preferred_platform as string) || ""}
                                onChange={(e) => updateEditIndustryField("preferred_platform", e.target.value)}
                                className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                              >
                                <option value="">Select Platform</option>
                                <option value="Messenger">Messenger</option>
                                <option value="WhatsApp">WhatsApp</option>
                              </select>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button type="submit" disabled={savingId === selectedLead.id || !!editPhoneWarning} className="flex-1 h-11 rounded-xl bg-brand-600 text-sm font-bold text-white shadow-glow transition hover:bg-brand-500 disabled:opacity-60">
                      Save Changes
                    </button>
                    <button type="button" onClick={() => deleteLead(selectedLead.id)} className="h-11 rounded-xl bg-rose-500/10 px-4 text-sm font-semibold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400">
                      Delete
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}

      {selectedLeadIds.length > 0 && (
        <>
          {(bulkAssignOpen || bulkStageOpen) && (
            <div className="fixed inset-0 z-[80]" onClick={() => { setBulkAssignOpen(false); setBulkStageOpen(false); }} />
          )}
          <div className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-white/20 bg-white/95 p-3 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/95 animate-fade-up">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {selectedLeadIds.length} leads selected
            </span>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setBulkAssignOpen(!bulkAssignOpen); setBulkStageOpen(false); }}
                  className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <User size={14} />
                  <span>Assign</span>
                </button>
                {bulkAssignOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 max-h-60 overflow-y-auto rounded-xl border border-slate-100 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-800 z-[90]">
                    <button
                      type="button"
                      onClick={() => bulkAssign("")}
                      className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-brand-500 hover:text-white dark:text-slate-300"
                    >
                      Unassigned
                    </button>
                    {users.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => bulkAssign(u.id)}
                        className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-brand-500 hover:text-white dark:text-slate-300"
                      >
                        {u.name || u.email || u.id}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setBulkStageOpen(!bulkStageOpen); setBulkAssignOpen(false); }}
                  className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Filter size={14} />
                  <span>Change Stage</span>
                </button>
                {bulkStageOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 max-h-60 overflow-y-auto rounded-xl border border-slate-100 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-800 z-[90]">
                    <button
                      type="button"
                      onClick={() => bulkChangeStage("")}
                      className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-brand-500 hover:text-white dark:text-slate-300"
                    >
                      No Stage
                    </button>
                    {configs.stages.map((stage) => (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => bulkChangeStage(stage.id)}
                        className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-brand-500 hover:text-white dark:text-slate-300"
                      >
                        {stage.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";
                  const params = new URLSearchParams();
                  selectedLeadIds.forEach((id) => params.append("lead_ids", id));
                  window.open(`${baseUrl}/leads/export?${params.toString()}`);
                }}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <FileText size={14} />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsBulkShareOpen(true);
                  setBulkShareLinks([]);
                  setBulkShareError(null);
                }}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Globe size={14} />
                <span>Bulk Share</span>
              </button>

              <button
                type="button"
                onClick={bulkDelete}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-rose-50 px-4 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </>
      )}

      {isBulkShareOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Bulk Share Leads</h3>
              <button onClick={() => { setIsBulkShareOpen(false); setBulkShareLinks([]); }} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-5">Generate secure share links for all <strong>{selectedLeadIds.length} selected leads</strong>.</p>
            
            {bulkShareLinks.length > 0 ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20 text-center">
                  <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Share links generated successfully!</p>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {bulkShareLinks.map((link, idx) => (
                    <div key={idx} className="flex gap-2 items-center rounded-xl bg-white/50 border border-slate-200 dark:bg-black/30 dark:border-white/10 p-2 text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{link.company}:</span>
                      <input readOnly value={link.url} className="flex-1 bg-transparent truncate outline-none text-slate-500" />
                      <button onClick={() => navigator.clipboard.writeText(link.url)} className="rounded bg-brand-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-brand-400">Copy</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => { setIsBulkShareOpen(false); setBulkShareLinks([]); }} className="w-full h-11 rounded-xl bg-brand-600 text-sm font-bold text-white hover:bg-brand-500">Close</button>
              </div>
            ) : (
              <form onSubmit={handleBulkShareSubmit} className="space-y-4">
                {bulkShareError && <div className="text-xs text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">{bulkShareError}</div>}
                
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button type="button" onClick={() => setBulkShareMode("restricted")} className={`rounded-lg py-2 text-xs font-bold transition ${bulkShareMode === "restricted" ? "bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-700"}`}>Specific Emails</button>
                  <button type="button" onClick={() => setBulkShareMode("public")} className={`rounded-lg py-2 text-xs font-bold transition ${bulkShareMode === "public" ? "bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-700"}`}>Anyone with link</button>
                </div>

                {bulkShareMode === "restricted" && (
                  <label className="block">
                    <span className="mb-1 text-[11px] font-bold uppercase text-slate-500">Allowed Emails (comma separated)</span>
                    <input 
                      value={bulkShareEmails} 
                      onChange={e => setBulkShareEmails(e.target.value)} 
                      placeholder="partner@example.com, client@example.com"
                      className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                    />
                  </label>
                )}

                <div className="pt-2">
                  <button type="submit" disabled={bulkSharing} className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-glow transition hover:bg-brand-500 disabled:opacity-60">
                    {bulkSharing ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                    Generate {selectedLeadIds.length} Links
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
      {shareLeadId && (() => {
        const lead = leads.find(l => l.id === shareLeadId);
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm transition-opacity">
            <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-2xl p-6 animate-scale-in">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Share Lead</h3>
                <button onClick={() => { setShareLeadId(null); setShareLink(null); }} className="p-1 text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-slate-500 mb-5">Share <strong>{lead?.company_name || lead?.contact_person}</strong> with external partners or users.</p>
              
              {shareLink ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20 text-center">
                    <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Share link generated successfully!</p>
                  </div>
                  <div className="flex gap-2 items-center rounded-xl bg-white/50 border border-slate-200 dark:bg-black/30 dark:border-white/10 p-2">
                    <input readOnly value={shareLink} className="flex-1 bg-transparent text-sm px-2 outline-none text-slate-600 dark:text-slate-300" />
                    <button onClick={() => navigator.clipboard.writeText(shareLink)} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white shadow-glow hover:bg-brand-400">Copy</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleShareLead} className="space-y-4">
                  {shareError && <div className="text-xs text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">{shareError}</div>}
                  
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button type="button" onClick={() => setShareMode("restricted")} className={`rounded-lg py-2 text-xs font-bold transition ${shareMode === "restricted" ? "bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-700"}`}>Specific Emails</button>
                    <button type="button" onClick={() => setShareMode("public")} className={`rounded-lg py-2 text-xs font-bold transition ${shareMode === "public" ? "bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-700"}`}>Anyone with link</button>
                  </div>

                  {shareMode === "restricted" && (
                    <label className="block">
                      <span className="mb-1 text-[11px] font-bold uppercase text-slate-500">Allowed Emails (comma separated)</span>
                      <input 
                        value={shareEmails} 
                        onChange={e => setShareEmails(e.target.value)} 
                        placeholder="partner@example.com, client@example.com"
                        className="h-10 w-full rounded-xl border border-white/50 bg-white/50 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
                      />
                    </label>
                  )}

                  <div className="pt-2">
                    <button type="submit" disabled={sharing} className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-glow transition hover:bg-brand-500 disabled:opacity-60">
                      {sharing ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                      Generate Link
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}

    </ProtectedPage>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    }>
      <LeadsContent />
    </Suspense>
  );
}
