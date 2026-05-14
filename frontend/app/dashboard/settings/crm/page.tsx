"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Cable, Edit2, GripVertical, Loader2, Plus, Settings2, Shield, Trash2, X, Zap } from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { LeadNamedConfig, LeadSourceConfig, LeadStageConfig } from "@/types/crm";

type TabKey = "sources" | "stages" | "sectors" | "areas" | "professions";
type ConfigItem = LeadSourceConfig | LeadStageConfig | LeadNamedConfig;

const tabs: { key: TabKey; label: string; endpoint: string }[] = [
  { key: "sources", label: "Lead Sources", endpoint: "/config/lead-sources" },
  { key: "stages", label: "Lead Stages", endpoint: "/config/lead-stages" },
  { key: "sectors", label: "Lead Sector", endpoint: "/config/lead-sectors" },
  { key: "areas", label: "Lead Area", endpoint: "/config/lead-areas" },
  { key: "professions", label: "Lead Professions", endpoint: "/config/lead-professions" },
];

function isSource(item: ConfigItem): item is LeadSourceConfig {
  return "cost_per_lead" in item;
}

function isStage(item: ConfigItem): item is LeadStageConfig {
  return "probability_percent" in item;
}

export default function CRMConfigPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("sources");
  const [data, setData] = useState<Record<TabKey, ConfigItem[]>>({
    sources: [],
    stages: [],
    sectors: [],
    areas: [],
    professions: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [costPerLead, setCostPerLead] = useState("0");
  const [probability, setProbability] = useState("0");
  const [position, setPosition] = useState("0");
  const [isClosed, setIsClosed] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const activeConfig = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const rows = data[activeTab];

  async function loadConfig() {
    setLoading(true);
    try {
      const entries = await Promise.all(
        tabs.map(async (tab) => [tab.key, await apiRequest<ConfigItem[]>(tab.endpoint)] as const),
      );
      setData(Object.fromEntries(entries) as Record<TabKey, ConfigItem[]>);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, []);

  function openCreate() {
    setEditingItem(null);
    setName("");
    setCostPerLead("0");
    setProbability("0");
    setPosition(String(activeTab === "stages" ? rows.length + 1 : 0));
    setIsClosed(false);
    setIsActive(true);
    setModalOpen(true);
  }

  function openEdit(item: ConfigItem) {
    setEditingItem(item);
    setName(item.name);
    setIsActive(item.is_active);
    setCostPerLead(isSource(item) ? String(item.cost_per_lead) : "0");
    setProbability(isStage(item) ? String(item.probability_percent) : "0");
    setPosition(isStage(item) ? String(item.position) : "0");
    setIsClosed(isStage(item) ? item.is_closed : false);
    setModalOpen(true);
  }

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const payload =
      activeTab === "sources"
        ? { name, cost_per_lead: Number(costPerLead) || 0, is_active: isActive }
        : activeTab === "stages"
          ? {
              name,
              probability_percent: Number(probability) || 0,
              position: Number(position) || rows.length + 1,
              is_closed: isClosed,
              is_active: isActive,
            }
          : { name, is_active: isActive };

    try {
      await apiRequest(editingItem ? `${activeConfig.endpoint}/${editingItem.id}` : activeConfig.endpoint, {
        method: editingItem ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setModalOpen(false);
      await loadConfig();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteConfig(item: ConfigItem) {
    const ok = window.confirm(`Delete "${item.name}"? Existing leads may still reference this item.`);
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`${activeConfig.endpoint}/${item.id}`, { method: "DELETE" });
      await loadConfig();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function nudgeStage(item: LeadStageConfig, direction: -1 | 1) {
    const sortedStages = [...(data.stages as LeadStageConfig[])].sort((a, b) => a.position - b.position);
    const currentIndex = sortedStages.findIndex((stage) => stage.id === item.id);
    const swap = sortedStages[currentIndex + direction];
    if (!swap) return;
    setSaving(true);
    try {
      await Promise.all([
        apiRequest(`/config/lead-stages/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ position: swap.position }),
        }),
        apiRequest(`/config/lead-stages/${swap.id}`, {
          method: "PATCH",
          body: JSON.stringify({ position: item.position }),
        }),
      ]);
      await loadConfig();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const title = useMemo(() => activeConfig.label, [activeConfig.label]);

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">
        <div className="mb-6 flex items-center gap-2 border-b border-white/20 dark:border-white/10">
          <Link href="/dashboard/settings/channels" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
            <Cable size={16} />
            Channels
          </Link>
          <Link href="/dashboard/settings/ai" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
            <Zap size={16} />
            AI & Automation
          </Link>
          <Link href="/dashboard/settings/permissions" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
            <Shield size={16} />
            Permissions
          </Link>
          <Link href="/dashboard/settings/crm" className="flex items-center gap-2 border-b-2 border-brand-500 px-4 py-3 text-sm font-medium text-brand-600 transition dark:text-brand-400">
            <Settings2 size={16} />
            CRM Configuration
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400">Settings</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Lead Configuration</h1>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <div className="flex flex-col gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? "bg-brand-500 text-white shadow-glow-sm"
                    : "bg-white/40 text-slate-600 hover:bg-white/70 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                {tab.label}
                <span className="text-xs opacity-70">{data[tab.key].length}</span>
              </button>
            ))}
          </div>

          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/20 px-5 py-4 dark:border-white/10">
              <h2 className="font-bold text-slate-900 dark:text-white">{title}</h2>
              <button
                type="button"
                onClick={openCreate}
                className="flex h-9 items-center gap-2 rounded-xl bg-brand-600 px-4 text-xs font-bold text-white shadow-glow transition hover:bg-brand-500 active:scale-95"
              >
                <Plus size={14} />
                Add New
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/10 text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-5 py-3 font-semibold">Sl</th>
                    <th className="px-5 py-3 font-semibold">Name</th>
                    {activeTab === "sources" && <th className="px-5 py-3 font-semibold">Cost Per Lead</th>}
                    {activeTab === "stages" && (
                      <>
                        <th className="px-5 py-3 font-semibold">Probability</th>
                        <th className="px-5 py-3 font-semibold">Position</th>
                        <th className="px-5 py-3 font-semibold">Closed</th>
                      </>
                    )}
                    <th className="px-5 py-3 font-semibold">Active</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                        <Loader2 size={16} className="mr-2 inline animate-spin" />
                        Loading configuration
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                        No configuration items yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((item, index) => (
                      <tr key={item.id} className="transition hover:bg-white/5">
                        <td className="px-5 py-4 font-medium text-slate-700 dark:text-slate-300">{index + 1}</td>
                        <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">{item.name}</td>
                        {activeTab === "sources" && <td className="px-5 py-4 text-slate-600 dark:text-slate-400">BDT {isSource(item) ? item.cost_per_lead : 0}</td>}
                        {activeTab === "stages" && isStage(item) && (
                          <>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{item.probability_percent}%</td>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => void nudgeStage(item, -1)} className="rounded-lg p-1 text-slate-400 hover:bg-white/50 hover:text-brand-600">
                                  <GripVertical size={14} />
                                </button>
                                {item.position}
                                <button type="button" onClick={() => void nudgeStage(item, 1)} className="rounded-lg p-1 text-slate-400 hover:bg-white/50 hover:text-brand-600">
                                  <GripVertical size={14} />
                                </button>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{item.is_closed ? "Yes" : "No"}</td>
                          </>
                        )}
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => void apiRequest(`${activeConfig.endpoint}/${item.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({ is_active: !item.is_active }),
                            }).then(loadConfig).catch((err) => setError((err as Error).message))}
                            className={`h-5 w-9 rounded-full p-0.5 transition-colors ${item.is_active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                          >
                            <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${item.is_active ? "translate-x-4" : "translate-x-0"}`} />
                          </button>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openEdit(item)} className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-500/10 hover:text-brand-600">
                              <Edit2 size={16} />
                            </button>
                            <button type="button" onClick={() => void deleteConfig(item)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-600">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-white/10 px-5 py-3 text-xs text-slate-500">
              Showing {rows.length ? 1 : 0} to {rows.length} of {rows.length} entries
            </div>
          </div>
        </div>

        {modalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <form onSubmit={saveConfig} className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl dark:bg-slate-900/95">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editingItem ? "Edit" : "Add"} {title}</h2>
                  <p className="text-xs text-slate-500">Changes apply immediately to dynamic CRM dropdowns.</p>
                </div>
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Name</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} required className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </label>
                {activeTab === "sources" ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Cost Per Lead</span>
                    <input type="number" min="0" step="0.01" value={costPerLead} onChange={(event) => setCostPerLead(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                  </label>
                ) : null}
                {activeTab === "stages" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Probability %</span>
                      <input type="number" min="0" max="100" value={probability} onChange={(event) => setProbability(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Position</span>
                      <input type="number" min="0" value={position} onChange={(event) => setPosition(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-black/20 dark:text-white" />
                    </label>
                  </div>
                ) : null}
                <div className="flex items-center justify-between rounded-xl bg-slate-100/70 px-3 py-2 dark:bg-white/5">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Active</span>
                  <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                </div>
                {activeTab === "stages" ? (
                  <div className="flex items-center justify-between rounded-xl bg-slate-100/70 px-3 py-2 dark:bg-white/5">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Closed stage</span>
                    <input type="checkbox" checked={isClosed} onChange={(event) => setIsClosed(event.target.checked)} />
                  </div>
                ) : null}
              </div>

              <button disabled={saving} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-bold text-white transition hover:bg-brand-500 disabled:opacity-60">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Save Configuration
              </button>
            </form>
          </div>
        ) : null}
      </section>
    </ProtectedPage>
  );
}
