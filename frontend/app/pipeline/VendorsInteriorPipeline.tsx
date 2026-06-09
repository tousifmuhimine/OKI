"use client";

import { useState } from "react";
import {
  TrendingUp, Search, RefreshCw, X, Loader2, CheckCircle2, ChevronRight, Plus, Trash2, Calendar, DollarSign, Edit
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
    milestones?: Record<string, string>;
    boq_items?: Array<{ id: string; material: string; quantity: number; unit_price: number; total: number }>;
    supplier_payments?: Array<{ id: string; supplier: string; amount: number; date: string; remarks: string }>;
  } | null;
};

interface VendorsInteriorPipelineProps {
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

const milestoneKeys = [
  { key: "site_measurement", label: "Site Measurement" },
  { key: "layout_concept_design", label: "Layout/Concept Design" },
  { key: "boq_costing", label: "BOQ & Costing" },
  { key: "advance_work_order", label: "Advance & Work Order" },
  { key: "handover", label: "Handover" }
];

const cellStatuses = ["Pending", "In Progress", "Revisions", "Approved"];

export function VendorsInteriorPipeline({
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
}: VendorsInteriorPipelineProps) {
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [selectedMilestoneKey, setSelectedMilestoneKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // BOQ Form State
  const [newMaterial, setNewMaterial] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newPrice, setNewPrice] = useState("");

  // Payment Form State
  const [newSupplier, setNewSupplier] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newRemarks, setNewRemarks] = useState("");

  const activeOpp = opportunities.find(o => o.id === selectedOppId) || null;
  const activeMilestone = milestoneKeys.find(m => m.key === selectedMilestoneKey) || null;

  const getCellStatus = (opp: Opportunity, mKey: string): string => {
    return opp.industry_data?.milestones?.[mKey] || "Pending";
  };

  const getCellStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
      case "In Progress":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30";
      case "Revisions":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
      default:
        return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
    }
  };

  const updateOpportunityIndustry = async (updatedData: Partial<NonNullable<Opportunity["industry_data"]>>) => {
    if (!activeOpp) return;
    setSaving(true);
    try {
      const currentIndustry = activeOpp.industry_data || {};
      const newIndustry = {
        ...currentIndustry,
        ...updatedData
      };

      // Auto update overall opportunity stage if a milestone is approved
      let targetStage = activeOpp.stage;
      if (updatedData.milestones) {
        // Find latest approved milestone
        const approved = milestoneKeys.filter(m => (updatedData.milestones?.[m.key] || currentIndustry.milestones?.[m.key]) === "Approved");
        if (approved.length > 0) {
          targetStage = approved[approved.length - 1].label;
        }
      }

      await apiRequest(`/opportunities/${activeOpp.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          industry_data: newIndustry,
          stage: targetStage
        }),
      });
      await loadOpportunities();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!activeOpp || !selectedMilestoneKey) return;
    const currentMilestones = activeOpp.industry_data?.milestones || {};
    const updatedMilestones = {
      ...currentMilestones,
      [selectedMilestoneKey]: status
    };
    await updateOpportunityIndustry({ milestones: updatedMilestones });
  };

  const handleAddBOQItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOpp || !newMaterial.trim() || !newQty || !newPrice) return;
    const items = activeOpp.industry_data?.boq_items || [];
    const newItem = {
      id: Math.random().toString(36).substring(2, 9),
      material: newMaterial.trim(),
      quantity: parseFloat(newQty) || 0,
      unit_price: parseFloat(newPrice) || 0,
      total: (parseFloat(newQty) || 0) * (parseFloat(newPrice) || 0)
    };
    await updateOpportunityIndustry({ boq_items: [...items, newItem] });
    setNewMaterial(""); setNewQty(""); setNewPrice("");
  };

  const handleDeleteBOQItem = async (itemId: string) => {
    if (!activeOpp) return;
    const items = activeOpp.industry_data?.boq_items || [];
    const updated = items.filter(item => item.id !== itemId);
    await updateOpportunityIndustry({ boq_items: updated });
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOpp || !newSupplier.trim() || !newAmount) return;
    const payments = activeOpp.industry_data?.supplier_payments || [];
    const newPayment = {
      id: Math.random().toString(36).substring(2, 9),
      supplier: newSupplier.trim(),
      amount: parseFloat(newAmount) || 0,
      date: newDate || new Date().toISOString().split("T")[0],
      remarks: newRemarks.trim()
    };
    await updateOpportunityIndustry({ supplier_payments: [...payments, newPayment] });
    setNewSupplier(""); setNewAmount(""); setNewDate(""); setNewRemarks("");
  };

  const handleDeletePayment = async (payId: string) => {
    if (!activeOpp) return;
    const payments = activeOpp.industry_data?.supplier_payments || [];
    const updated = payments.filter(p => p.id !== payId);
    await updateOpportunityIndustry({ supplier_payments: updated });
  };

  const filtered = opportunities.filter(o => {
    const q = search.trim().toLowerCase();
    return !q || o.title.toLowerCase().includes(q) || o.customer_id.toLowerCase().includes(q);
  });

  const getBOQTotal = (opp: Opportunity) => {
    return opp.industry_data?.boq_items?.reduce((acc, item) => acc + item.total, 0) || 0;
  };

  const getPaymentsTotal = (opp: Opportunity) => {
    return opp.industry_data?.supplier_payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">
            <TrendingUp size={14} /> Vendors & Interior Project Board
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white font-outfit">Project Milestone Grid</h1>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/50 bg-white/50 px-3 dark:border-white/10 dark:bg-black/20 sm:min-w-[200px]">
            <Search size={15} className="text-slate-500" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
              placeholder="Search design projects..."
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
          <span className="ml-3 text-sm text-slate-500">Loading interior projects…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center gap-4 py-20 text-center rounded-2xl border border-white/20">
          <CheckCircle2 size={40} className="text-brand-300 dark:text-brand-600" />
          <p className="text-base font-semibold text-slate-600 dark:text-slate-300">No interior projects found</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">Create new design deals to display in the matrix.</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto border border-white/20 dark:border-slate-800 rounded-3xl bg-white/20 dark:bg-slate-900/10 shadow-lg backdrop-blur-md">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/20 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40">
                <th className="p-4 font-bold text-slate-800 dark:text-slate-200 min-w-[220px]">Design Project (Active)</th>
                {milestoneKeys.map(milestone => (
                  <th key={milestone.key} className="p-4 font-bold text-slate-800 dark:text-slate-200 text-center min-w-[150px]">
                    {milestone.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(opp => (
                <tr key={opp.id} className="border-b border-white/10 dark:border-slate-800/50 hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-900 dark:text-white leading-tight">{opp.title}</div>
                    <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                      <span>Value: {formatCurrency(opp.estimated_value)}</span>
                      <span>•</span>
                      <span className="font-mono">{opp.customer_id.substring(0, 10)}...</span>
                    </div>
                  </td>
                  {milestoneKeys.map(milestone => {
                    const status = getCellStatus(opp, milestone.key);
                    return (
                      <td key={milestone.key} className="p-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedOppId(opp.id);
                            setSelectedMilestoneKey(milestone.key);
                          }}
                          className={`w-full max-w-[140px] px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 ${getCellStatusColor(status)}`}
                        >
                          {status}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* RHS Drawer slide-out */}
      {selectedOppId && selectedMilestoneKey && activeOpp && activeMilestone && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm">
          {/* Overlay area click closes */}
          <button
            onClick={() => {
              setSelectedOppId(null);
              setSelectedMilestoneKey(null);
            }}
            className="absolute inset-0 w-full h-full cursor-default"
          />

          {/* Drawer content */}
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 h-full p-6 shadow-2xl flex flex-col gap-6 overflow-y-auto animate-fade-left">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-outfit">{activeOpp.title}</h3>
                <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5 font-semibold">
                  Milestone: {activeMilestone.label}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedOppId(null);
                  setSelectedMilestoneKey(null);
                }}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            {/* Change milestone status */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Update Status</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {cellStatuses.map(status => {
                  const currentStatus = getCellStatus(activeOpp, selectedMilestoneKey);
                  const isSelected = currentStatus === status;
                  return (
                    <button
                      key={status}
                      disabled={saving}
                      onClick={() => handleStatusChange(status)}
                      className={`h-10 text-xs font-extrabold rounded-xl border transition flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      {saving && isSelected && <Loader2 size={12} className="animate-spin" />}
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom BOQ component for 'boq_costing' Milestone */}
            {selectedMilestoneKey === "boq_costing" && (
              <div className="space-y-4 border-t border-slate-200/50 dark:border-slate-800 pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bill of Quantities (BOQ)</h4>
                  <span className="text-sm font-black text-brand-600 dark:text-brand-400">
                    Total: {formatCurrency(getBOQTotal(activeOpp))}
                  </span>
                </div>

                {/* Items List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {(activeOpp.industry_data?.boq_items || []).map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{item.material}</span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {item.quantity} units x {formatCurrency(item.unit_price)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">{formatCurrency(item.total)}</span>
                        <button
                          onClick={() => handleDeleteBOQItem(item.id)}
                          className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(activeOpp.industry_data?.boq_items || []).length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-4">No BOQ items created yet.</p>
                  )}
                </div>

                {/* Form to add item */}
                <form onSubmit={handleAddBOQItem} className="space-y-3 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Add Material / Service</div>
                  <input
                    required
                    placeholder="Material/Service name"
                    value={newMaterial}
                    onChange={e => setNewMaterial(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-black/20 px-3 text-xs outline-none focus:border-brand-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      required
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={newQty}
                      onChange={e => setNewQty(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-black/20 px-3 text-xs outline-none focus:border-brand-500"
                    />
                    <input
                      required
                      type="number"
                      min="1"
                      placeholder="Price per unit"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-black/20 px-3 text-xs outline-none focus:border-brand-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full h-10 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-glow-sm"
                  >
                    <Plus size={14} /> Add Line Item
                  </button>
                </form>
              </div>
            )}

            {/* Custom Supplier Payments component for 'advance_work_order' and 'handover' Milestones */}
            {(selectedMilestoneKey === "advance_work_order" || selectedMilestoneKey === "handover") && (
              <div className="space-y-4 border-t border-slate-200/50 dark:border-slate-800 pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Supplier Payments Log</h4>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    Total Logged: {formatCurrency(getPaymentsTotal(activeOpp))}
                  </span>
                </div>

                {/* Payments List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {(activeOpp.industry_data?.supplier_payments || []).map(pay => (
                    <div key={pay.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-slate-800/80 animate-fade-in">
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{pay.supplier}</span>
                        <span className="block text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <Calendar size={10} />
                          {pay.date} {pay.remarks && `• ${pay.remarks}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-black text-slate-900 dark:text-white font-mono">{formatCurrency(pay.amount)}</span>
                        <button
                          onClick={() => handleDeletePayment(pay.id)}
                          className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(activeOpp.industry_data?.supplier_payments || []).length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-4">No supplier payments logged yet.</p>
                  )}
                </div>

                {/* Form to log payment */}
                <form onSubmit={handleAddPayment} className="space-y-3 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Log Supplier Payment</div>
                  <input
                    required
                    placeholder="Supplier name"
                    value={newSupplier}
                    onChange={e => setNewSupplier(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-black/20 px-3 text-xs outline-none focus:border-brand-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      required
                      type="number"
                      placeholder="Amount (BDT)"
                      value={newAmount}
                      onChange={e => setNewAmount(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-black/20 px-3 text-xs outline-none focus:border-brand-500"
                    />
                    <input
                      type="date"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-black/20 px-3 text-xs outline-none focus:border-brand-500"
                    />
                  </div>
                  <input
                    placeholder="Remarks (optional)"
                    value={newRemarks}
                    onChange={e => setNewRemarks(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-black/20 px-3 text-xs outline-none focus:border-brand-500"
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-glow-sm"
                  >
                    <Plus size={14} /> Log Payment
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
