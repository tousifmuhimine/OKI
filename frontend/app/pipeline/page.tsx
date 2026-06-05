"use client";

import { useEffect, useState, useCallback } from "react";
import { ProtectedPage } from "@/components/protected-page";
import {
  Plus, TrendingUp, Search, Filter, MoreHorizontal,
  Calendar, Building2, User, Globe, RefreshCw, X,
  Loader2, CheckCircle2, Trophy,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { StudyAbroadPipeline } from "./StudyAbroadPipeline";
import { EcommercePipeline } from "./EcommercePipeline";
import { VendorsInteriorPipeline } from "./VendorsInteriorPipeline";
import { RealEstatePipeline } from "./RealEstatePipeline";
import { isDemoSessionActive } from "@/lib/demo-auth";

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

// ─── Stage Config Tone Helper ────────────────────────────────────
const getStageTone = (index: number, name: string) => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("won") || nameLower.includes("complete") || nameLower.includes("fly") || nameLower.includes("delivered") || nameLower.includes("finished")) {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30";
  }
  if (nameLower.includes("lost") || nameLower.includes("cancel") || nameLower.includes("return")) {
    return "bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-slate-500/30";
  }
  const tones = [
    "bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-500/30",
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30",
    "bg-purple-500/15 text-purple-700 dark:text-purple-300 ring-purple-500/30",
    "bg-pink-500/15 text-pink-700 dark:text-pink-300 ring-pink-500/30",
    "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 ring-cyan-500/30",
    "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-indigo-500/30",
  ];
  return tones[index % tones.length];
};

export default function PipelinePage() {
  const [stages, setStages] = useState<{ key: string; label: string; tone: string }[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState("BDT");
  const [search, setSearch] = useState("");
  const [newStage, setNewStage] = useState("");
  const [orgTypeCode, setOrgTypeCode] = useState<string | null>(null);

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

  const loadOrgType = useCallback(async () => {
    if (isDemoSessionActive()) {
      setOrgTypeCode("study_abroad");
      return;
    }
    try {
      const orgRes = await apiRequest<{ company_name: string; organization_type_code: string | null }>("/organizations/me");
      setOrgTypeCode(orgRes.organization_type_code || "study_abroad");
    } catch {
      setOrgTypeCode("study_abroad");
    }
  }, []);

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const pipeRes = await apiRequest<{ id: string; name: string; stages: any[] }>("/opportunities/pipeline");
      const mappedStages = pipeRes.stages.map((s, idx) => ({
        key: s.name.toLowerCase().replace(/\s+/g, "_"),
        label: s.name,
        tone: getStageTone(idx, s.name),
      }));
      setStages(mappedStages);
      if (mappedStages.length > 0 && !newStage) {
        setNewStage(mappedStages[0].key);
      }

      const res = await apiRequest<OpportunityListResponse>("/opportunities?limit=200&offset=0");
      const mappedOpps = res.data.map(opp => {
        const stageKey = opp.stage ? opp.stage.toLowerCase().replace(/\s+/g, "_") : "";
        const matchedStage = mappedStages.find(s => s.key === stageKey || s.label.toLowerCase() === opp.stage.toLowerCase());
        return {
          ...opp,
          estimated_value: Number(opp.estimated_value) || 0,
          stage: matchedStage ? matchedStage.key : (opp.stage || "discovery").toLowerCase().replace(/\s+/g, "_"),
        };
      });
      setOpportunities(mappedOpps);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [newStage]);

  useEffect(() => {
    void loadOrgType();
    void loadOpportunities();
  }, [loadOpportunities, loadOrgType]);

  const pipelineProps = {
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
  };

  const renderPipeline = () => {
    switch (orgTypeCode) {
      case "ecommerce":
        return <EcommercePipeline {...pipelineProps} />;
      case "vendors_interior":
        return <VendorsInteriorPipeline {...pipelineProps} />;
      case "real_estate":
        return <RealEstatePipeline {...pipelineProps} />;
      case "study_abroad":
      default:
        return <StudyAbroadPipeline {...pipelineProps} />;
    }
  };

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] overflow-x-clip bg-transparent px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
        <div className="mx-auto w-full max-w-screen-2xl min-w-0 animate-fade-up">
          {orgTypeCode === null ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-brand-500" />
              <span className="ml-3 text-sm text-slate-500 font-semibold">Resolving workspace settings…</span>
            </div>
          ) : (
            renderPipeline()
          )}
        </div>
      </section>
    </ProtectedPage>
  );
}
