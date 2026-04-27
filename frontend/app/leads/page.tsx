"use client";

import { FormEvent, useEffect, useState } from "react";
import { Zap, Plus, Building2, User, Radio } from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { Lead, LeadListResponse } from "@/types/crm";

export default function LeadsPage() {
  const [leads, setLeads]               = useState<Lead[]>([]);
  const [companyName, setCompanyName]   = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [source, setSource]             = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);

  async function loadLeads() {
    try {
      const response = await apiRequest<LeadListResponse>("/leads?limit=50&offset=0");
      setLeads(response.data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { void loadLeads(); }, []);

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await apiRequest<Lead>("/leads", {
        method: "POST",
        body: JSON.stringify({
          company_name: companyName,
          contact_person: contactPerson || null,
          source: source || null,
          status: "new",
        }),
      });
      setCompanyName(""); setContactPerson(""); setSource("");
      await loadLeads();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const statusBadge: Record<string, string> = {
    new:        "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
    contacted:  "bg-purple-500/20 text-purple-700 dark:bg-purple-500/30 dark:text-purple-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
    qualified:  "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
    lost:       "bg-white/40 text-slate-600 dark:bg-white/10 dark:text-slate-400 border border-white/20 dark:border-white/5",
  };

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400 drop-shadow-sm">Sales Pipeline</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white drop-shadow-sm">OKKI Leads</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 glass-panel px-3 py-1.5 rounded-xl">
            <Zap size={14} className="text-brand-500 dark:text-brand-400" />
            <span>{leads.length} total</span>
          </div>
        </div>

        <form
          onSubmit={createLead}
          className="mb-6 grid animate-fade-in gap-3 glass-card p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="relative">
            <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-xl border border-white/50 bg-white/50 dark:border-white/10 dark:bg-black/20 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white/80 focus:ring-2 focus:ring-brand-400/20 dark:text-white dark:focus:border-brand-500 dark:focus:bg-white/10"
              placeholder="Company name"
            />
          </div>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full rounded-xl border border-white/50 bg-white/50 dark:border-white/10 dark:bg-black/20 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white/80 focus:ring-2 focus:ring-brand-400/20 dark:text-white dark:focus:border-brand-500 dark:focus:bg-white/10"
              placeholder="Contact person"
            />
          </div>
          <div className="relative">
            <Radio size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-xl border border-white/50 bg-white/50 dark:border-white/10 dark:bg-black/20 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white/80 focus:ring-2 focus:ring-brand-400/20 dark:text-white dark:focus:border-brand-500 dark:focus:bg-white/10"
              placeholder="Lead source"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:from-brand-400 hover:to-indigo-500 active:scale-95 disabled:opacity-60"
          >
            <Plus size={15} />
            {loading ? "Adding…" : "Add lead"}
          </button>
        </form>

        {error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 backdrop-blur-md">
            {error}
          </p>
        ) : null}

        <div className="animate-fade-in overflow-hidden glass-card">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-white/20 bg-white/20 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                <th className="px-5 py-3.5">Company</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Source</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 dark:divide-white/10">
              {leads.map((lead) => (
                <tr key={lead.id} className="group transition hover:bg-white/40 dark:hover:bg-white/10">
                  <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100">{lead.company_name}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{lead.contact_person ?? "—"}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{lead.source ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusBadge[lead.status] ?? statusBadge["new"]}`}>
                      {lead.status}
                    </span>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={4}>
                    No leads yet. Add your first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </ProtectedPage>
  );
}
