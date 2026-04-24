"use client";

import { useEffect, useState } from "react";

import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { Customer, CustomerListResponse, DashboardSummary } from "@/types/crm";

const scheduleItems = [
  { color: "bg-[#1769ff]", title: "Sinai Liberation Day, Egypt", date: "2026-04-25" },
  { color: "bg-[#1769ff]", title: "Liberation Day, Italy", date: "2026-04-25" },
  { color: "bg-[#bf8a24]", title: "Sales funnel review", date: "2026-04-26" },
  { color: "bg-[#1769ff]", title: "King Day, Holland", date: "2026-04-27" },
  { color: "bg-[#1769ff]", title: "Freedom Day, South Africa", date: "2026-04-27" },
  { color: "bg-[#ff304d]", title: "Business meetings", date: "2026-04-27" },
  { color: "bg-[#19a96b]", title: "Customer payment confirmation", date: "2026-04-27" },
];

const taskTabs = [
  "All",
  "Message Replies",
  "Customer Follow-up",
  "Data Insights",
  "Approval",
  "Copy Trading Collaboration",
  "Opportunity Follow-up",
];

const goalLabels = [
  { key: "leads", label: "Number of email marketing contacts" },
  { key: "orders", label: "Closed order amount" },
  { key: "opportunities", label: "The amount of the opportunities" },
  { key: "customers", label: "Number of new business customers" },
  { key: "products", label: "The number of orders closed" },
] satisfies Array<{ key: keyof Pick<DashboardSummary, "customers" | "leads" | "opportunities" | "products" | "orders">; label: string }>;

function currentTime() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(currentTime);

  useEffect(() => {
    let active = true;

    Promise.all([
      apiRequest<DashboardSummary>("/dashboard/summary"),
      apiRequest<CustomerListResponse>("/customers?limit=8&offset=0"),
    ])
      .then(([summary, customerResponse]) => {
        if (!active) {
          return;
        }

        setData(summary);
        setCustomers(customerResponse.data);
        setError(null);
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(currentTime()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <ProtectedPage>
      <section className="min-h-[calc(100vh-54px)] bg-[#f3f5fc] px-7 pb-8 pt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[22px]">Hi admin</span>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm text-[#273043]">
            <span>◷ East 10th District: Sydney</span>
            <span className="font-mono text-[22px] tracking-[0.2em] text-[#6a5d5d]">{clock}</span>
            <span>▣ Exchange rate calculator</span>
            <span>▦ Workbench configuration</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-6">
            <section className="relative h-[286px] overflow-hidden rounded-lg bg-white px-7 py-6 shadow-sm">
              <div className="absolute right-8 top-7 flex gap-4 text-lg text-slate-500">
                <button type="button" aria-label="Add schedule item">
                  ⊕
                </button>
                <button type="button" aria-label="Schedule settings">
                  ⚙
                </button>
                <button type="button" aria-label="Expand schedule">
                  ⤢
                </button>
              </div>

              <div className="mb-4 flex items-center gap-4">
                <h1 className="text-xl font-semibold">Schedule</h1>
                <span className="text-lg text-slate-500">›</span>
                <div className="flex overflow-hidden rounded border border-[#b9c3d8] text-sm">
                  {["week", "month", "List"].map((label) => (
                    <button
                      key={label}
                      className={`h-7 px-3 ${label === "List" ? "border-l border-[#1769ff] text-[#005cff]" : "border-r border-[#d8deea]"}`}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pr-8">
                {scheduleItems.map((item) => (
                  <div key={`${item.title}-${item.date}`} className="grid grid-cols-[16px_minmax(0,1fr)_92px] items-center gap-1 text-sm">
                    <span className={`h-2 w-2 rounded-full ${item.color}`} />
                    <span className="truncate">{item.title}</span>
                    <span className="text-right text-[#005bd8]">{item.date}</span>
                  </div>
                ))}
              </div>

              <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded border border-[#2f72ff] bg-[#f8fbff] px-4 py-3 text-sm shadow-sm">
                <span className="mr-3 text-[#1769ff]">i</span>
                <span className="mr-3">3 new follow-up tasks</span>
                <button className="mr-2 text-[#005cff]" type="button">
                  Click Refresh
                </button>
                <button className="text-xl leading-none text-slate-600" type="button" aria-label="Dismiss notification">
                  ×
                </button>
              </div>
            </section>

            <section className="rounded-lg bg-[linear-gradient(135deg,#eaf7ff_0%,#f7f5ff_60%,#eef0ff_100%)] px-7 py-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Follow up on tasks</h2>
                  <p className="mt-3 text-sm">
                    Based on AI analysis and manager configuration, the following follow-up tasks are recommended for you.
                    Act now to continue to improve your performance!
                  </p>
                </div>
                <button className="text-sm text-slate-600" type="button">
                  ⚙ Display settings
                </button>
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                {taskTabs.map((tab, index) => {
                  const count = index === 0 || index === 2 ? customers.length : 0;
                  return (
                  <button
                    key={tab}
                    className={`h-9 rounded-md border px-4 text-sm ${
                      index === 0 ? "border-[#c9d2ff] bg-[#f5f7ff] text-[#4425ff]" : "border-white bg-white text-slate-600"
                    }`}
                    type="button"
                  >
                    {tab} ({count})
                  </button>
                  );
                })}
              </div>

              <div className="rounded-lg bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">customers</h3>
                    <span className="text-sm text-slate-500">Suspected Failed Mailboxes (99+) ›</span>
                    <span className="text-xs text-slate-400">?</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <button type="button">Ignore them all</button>
                    <button className="text-lg leading-none" type="button" aria-label="More task actions">
                      ⋮
                    </button>
                  </div>
                </div>

                {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-[#fafafa] text-left text-xs font-semibold text-[#111827]">
                        <th className="px-3 py-4">Company name</th>
                        <th className="px-3 py-4">nickname</th>
                        <th className="px-3 py-4">Invalid mailboxes</th>
                        <th className="px-3 py-4 text-right">operation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customers.map((row) => (
                        <tr key={row.id} className="h-[68px]">
                          <td className="px-3 py-3">{row.company_name}</td>
                          <td className="px-3 py-3">{row.contact_person ?? "info"}</td>
                          <td className="px-3 py-3">{row.country_region ?? "mailbox pending"}</td>
                          <td className="px-3 py-3 text-right text-[#005cff]">
                            <button className="px-2" type="button">
                              Disable contacts
                            </button>
                            <span className="text-slate-300">|</span>
                            <button className="px-2" type="button">
                              Delete the mailbox
                            </button>
                            <span className="text-slate-300">|</span>
                            <button className="px-2" type="button">
                              ignore
                            </button>
                          </td>
                        </tr>
                      ))}
                      {customers.length === 0 ? (
                        <tr>
                          <td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={4}>
                            No customer follow-up data available.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Goal completion</h2>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <span>My Enterp...</span>
                  <button type="button" aria-label="Goal settings">
                    ⚙
                  </button>
                </div>
              </div>

              <div className="mb-4 flex">
                <button className="h-8 border border-[#1769ff] px-3 text-sm text-[#005cff]" type="button">
                  Outcome Objectives
                </button>
                <button className="h-8 border border-l-0 border-slate-300 px-3 text-sm" type="button">
                  Process objectives
                </button>
              </div>

              <div className="space-y-5">
                {goalLabels.map((goal) => {
                  const value = data ? data[goal.key] : 0;
                  const width = Math.min(100, value * 10);

                  return (
                    <div key={goal.key}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="max-w-[250px] truncate">{goal.label} › ⓘ</span>
                        <span>{goal.key === "orders" || goal.key === "opportunities" ? `¥${value}` : value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-[#eeeeef]">
                        <div className="h-full bg-[#1769ff]" style={{ width: `${width}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        No target value is set <button className="ml-2 text-[#005cff]" type="button">Set it up now</button>
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Task completion</h2>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <span>Today⌄</span>
                  <span className="rounded bg-slate-100 px-3 py-1">admin ×</span>
                  <span>⌄</span>
                </div>
              </div>

              <div className="grid h-[190px] place-items-center">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-12 w-16 border-t-8 border-[#e5ebf6] bg-[#dfe6f2]">
                    <div className="mx-auto mt-3 h-2 w-6 bg-[#1769ff]" />
                  </div>
                  <p className="text-sm">No data available</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs">
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#00a76f]" />Completed in time</span>
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#e4a82f]" />Timeout completion</span>
                <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#d9dbe2]" />Not done</span>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </ProtectedPage>
  );
}
