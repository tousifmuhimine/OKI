"use client";

import { FormEvent, useEffect, useState } from "react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { Lead, LeadListResponse } from "@/types/crm";

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadLeads() {
    try {
      const response = await apiRequest<LeadListResponse>("/leads?limit=50&offset=0");
      setLeads(response.data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void loadLeads();
  }, []);

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      setCompanyName("");
      setContactPerson("");
      setSource("");
      await loadLeads();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <ProtectedPage>
      <section className="space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Sales Pipeline</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Leads</h1>
        </header>

        <form
          onSubmit={createLead}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4"
        >
          <input
            required
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5"
            placeholder="Company name"
          />
          <input
            value={contactPerson}
            onChange={(event) => setContactPerson(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5"
            placeholder="Contact person"
          />
          <input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5"
            placeholder="Lead source"
          />
          <button className="rounded-xl bg-blue-700 px-4 py-2.5 font-medium text-white hover:bg-blue-800" type="submit">
            Add lead
          </button>
        </form>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-card">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-4 py-3 text-sm text-slate-900">{lead.company_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{lead.contact_person ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{lead.source ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{lead.status}</td>
                </tr>
              ))}
              {leads.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-sm text-slate-500" colSpan={4}>
                    No leads yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </ProtectedPage>
  );
}
