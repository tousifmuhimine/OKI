"use client";

import { FormEvent, useEffect, useState } from "react";
import { Users, Plus, Building2, User, Globe } from "lucide-react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { Customer, CustomerListResponse } from "@/types/crm";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companyName, setCompanyName]     = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [countryRegion, setCountryRegion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadCustomers() {
    try {
      const response = await apiRequest<CustomerListResponse>("/customers?limit=50&offset=0");
      setCustomers(response.data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { void loadCustomers(); }, []);

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await apiRequest<Customer>("/customers", {
        method: "POST",
        body: JSON.stringify({
          company_name: companyName,
          contact_person: contactPerson || null,
          country_region: countryRegion || null,
          stage: "new",
          tags: {},
          score: 0,
        }),
      });
      setCompanyName(""); setContactPerson(""); setCountryRegion("");
      await loadCustomers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const stageBadge: Record<string, string> = {
    new:    "bg-brand-500/20 text-brand-700 dark:bg-brand-500/30 dark:text-brand-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
    active: "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
    closed: "bg-white/40 text-slate-600 dark:bg-white/10 dark:text-slate-400 border border-white/20 dark:border-white/5",
  };

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-transparent px-6 pb-10 pt-6">

        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 dark:text-brand-400 drop-shadow-sm">CRM</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white drop-shadow-sm">Customers</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 glass-panel px-3 py-1.5 rounded-xl">
            <Users size={14} className="text-brand-500 dark:text-brand-400" />
            <span>{customers.length} total</span>
          </div>
        </div>

        {/* Add form */}
        <form
          onSubmit={createCustomer}
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
            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              value={countryRegion}
              onChange={(e) => setCountryRegion(e.target.value)}
              className="w-full rounded-xl border border-white/50 bg-white/50 dark:border-white/10 dark:bg-black/20 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white/80 focus:ring-2 focus:ring-brand-400/20 dark:text-white dark:focus:border-brand-500 dark:focus:bg-white/10"
              placeholder="Country / region"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-glow-sm transition hover:from-brand-400 hover:to-indigo-500 active:scale-95 disabled:opacity-60"
          >
            <Plus size={15} />
            {loading ? "Adding…" : "Add customer"}
          </button>
        </form>

        {error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 backdrop-blur-md">
            {error}
          </p>
        ) : null}

        {/* Table */}
        <div className="glass-card animate-fade-up overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-white/20 bg-white/20 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                <th className="px-5 py-3.5">Company</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Region</th>
                <th className="px-5 py-3.5">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 dark:divide-white/10">
              {customers.map((c) => (
                <tr key={c.id} className="group transition hover:bg-white/40 dark:hover:bg-white/10">
                  <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100">{c.company_name}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{c.contact_person ?? "—"}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{c.country_region ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${stageBadge[c.stage] ?? stageBadge["new"]}`}>
                      {c.stage}
                    </span>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={4}>
                    No customers yet. Add your first one above.
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
