"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Cable, Zap, Shield, Settings2, Plus, Edit2, Trash2 } from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";

type TabKey = "sources" | "stages" | "sectors" | "areas" | "professions";

const dummyData = {
  sources: [
    { id: 1, name: "Fair", cost: "0.00", active: true },
    { id: 2, name: "Facebook", cost: "0.00", active: true },
  ],
  stages: [
    { id: 1, name: "New", probability: "10%", position: 1, closed: false },
    { id: 2, name: "Interested", probability: "20%", position: 2, closed: false },
  ],
  sectors: [{ id: 1, name: "Technology", active: true }],
  areas: [{ id: 1, name: "Dhaka", active: true }],
  professions: [{ id: 1, name: "Banker", active: true }, { id: 2, name: "Engineer", active: true }],
};

export default function CRMConfigPage() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<TabKey>("sources");

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">
        <div className="mb-6 flex items-center gap-2 border-b border-white/20 dark:border-white/10">
          <Link
            href="/dashboard/settings/channels"
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200`}
          >
            <Cable size={16} />
            Channels
          </Link>
          <Link
            href="/dashboard/settings/ai"
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200`}
          >
            <Zap size={16} />
            AI & Automation
          </Link>
          <Link
            href="/dashboard/settings/permissions"
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200`}
          >
            <Shield size={16} />
            Permissions
          </Link>
          <Link
            href="/dashboard/settings/crm"
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition border-b-2 border-brand-500 text-brand-600 dark:text-brand-400`}
          >
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

        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          {/* Sidebar Tabs */}
          <div className="flex flex-col gap-1">
            {([
              { key: "sources", label: "Lead Sources" },
              { key: "stages", label: "Lead Stages" },
              { key: "sectors", label: "Lead Sector" },
              { key: "areas", label: "Lead Area" },
              { key: "professions", label: "Lead Professions" },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? "bg-brand-500 text-white shadow-glow-sm"
                    : "bg-white/40 text-slate-600 hover:bg-white/70 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/20 px-5 py-4 dark:border-white/10">
              <h2 className="font-bold text-slate-900 dark:text-white capitalize">{activeTab.replace("professions", "Lead Professions")}</h2>
              <button className="flex h-9 items-center gap-2 rounded-xl bg-brand-600 px-4 text-xs font-bold text-white shadow-glow transition hover:bg-brand-500 active:scale-95">
                <Plus size={14} /> Add New
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/10 text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-5 py-3 font-semibold">Sl</th>
                    <th className="px-5 py-3 font-semibold capitalize">{activeTab.slice(0, -1)}</th>
                    
                    {activeTab === "sources" && <th className="px-5 py-3 font-semibold">Cost Per Lead</th>}
                    {activeTab === "stages" && (
                      <>
                        <th className="px-5 py-3 font-semibold">Probability</th>
                        <th className="px-5 py-3 font-semibold">Position</th>
                        <th className="px-5 py-3 font-semibold">Is Closed</th>
                      </>
                    )}
                    
                    {activeTab !== "stages" && <th className="px-5 py-3 font-semibold">Is Active</th>}
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {dummyData[activeTab].map((item, index) => (
                    <tr key={item.id} className="transition hover:bg-white/5">
                      <td className="px-5 py-4 font-medium text-slate-700 dark:text-slate-300">{index + 1}</td>
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">{item.name}</td>
                      
                      {activeTab === "sources" && <td className="px-5 py-4 text-slate-600 dark:text-slate-400">BDT {(item as any).cost}</td>}
                      {activeTab === "stages" && (
                        <>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{(item as any).probability}</td>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{(item as any).position}</td>
                          <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{(item as any).closed ? "Yes" : "No"}</td>
                        </>
                      )}
                      
                      {activeTab !== "stages" && (
                        <td className="px-5 py-4">
                          <div className={`h-5 w-9 rounded-full p-0.5 transition-colors ${item.active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                            <div className={`h-4 w-4 rounded-full bg-white transition-transform ${item.active ? "translate-x-4" : "translate-x-0"}`} />
                          </div>
                        </td>
                      )}
                      
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-500/10 hover:text-brand-600">
                            <Edit2 size={16} />
                          </button>
                          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-600">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-white/10 px-5 py-3 text-xs text-slate-500">
              Showing 1 to {dummyData[activeTab].length} of {dummyData[activeTab].length} entries
            </div>
          </div>
        </div>
      </section>
    </ProtectedPage>
  );
}
