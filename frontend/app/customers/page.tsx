"use client";

import { FormEvent, useEffect, useState } from "react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { Customer, CustomerListResponse } from "@/types/crm";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [countryRegion, setCountryRegion] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadCustomers() {
    try {
      const response = await apiRequest<CustomerListResponse>("/customers?limit=50&offset=0");
      setCustomers(response.data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void loadCustomers();
  }, []);

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      setCompanyName("");
      setContactPerson("");
      setCountryRegion("");
      await loadCustomers();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <ProtectedPage>
      <section className="space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">CRM</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Customers</h1>
        </header>

        <form
          onSubmit={createCustomer}
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
            value={countryRegion}
            onChange={(event) => setCountryRegion(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5"
            placeholder="Country/region"
          />
          <button className="rounded-xl bg-blue-700 px-4 py-2.5 font-medium text-white hover:bg-blue-800" type="submit">
            Add customer
          </button>
        </form>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-card">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Region</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-4 py-3 text-sm text-slate-900">{customer.company_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{customer.contact_person ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{customer.country_region ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{customer.stage}</td>
                </tr>
              ))}
              {customers.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-sm text-slate-500" colSpan={4}>
                    No customers yet.
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
